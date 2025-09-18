import { Router } from "express";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { z } from "zod";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { executeAgentFunction, agentFunctions } from "./ai/agents";
import type { Express, Request, Response } from "express";
import type { IStorage } from "./storage";
import type { User } from "@shared/schema";
import { insertUserSchema, insertJobListingSchema, insertApplicationSchema, insertChatMessageSchema } from "@shared/schema";
import rateLimitConfigs, { trackApiUsage, getRateLimitStatus } from "./middleware/rate-limiter";
import { initializeLangSmith } from "./services/langsmith-observability";
import { initializeWeaviate } from "./services/weaviate-service";
import vectorSearchRoutes from "./routes/vector-search";
import aiRoutes from "./routes/ai";
// import langchainRoutes from "./routes/langchain"; // temporarily disabled
import resumeRoutes from "./routes/resume";
import { JobScraperService } from "./services/job-scraper";
import { AIJobScraperService } from "./services/ai-job-scraper";
import { JobTemplateGenerator } from "./services/job-template-generator";

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Extend Express Request type
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

export async function setupRoutes(app: Express, storage: IStorage) {
  const router = Router();
  
  // Initialize advanced services
  await initializeWeaviate();
  await initializeLangSmith();
  
  // Initialize job scraper services
  const jobScraper = new JobScraperService(storage);
  const aiJobScraper = new AIJobScraperService(storage);
  
  // Schedule automatic job scraping every hour for both scrapers
  const scheduleAllScrapers = async () => {
    console.log('⏰ Running scheduled job scraping (RSS + AI)...');
    const startTime = Date.now();
    
    try {
      // Run both scrapers in parallel
      const [rssJobs, aiJobs] = await Promise.all([
        jobScraper.scrapeAllJobs().catch(err => {
          console.error('RSS scraper error:', err);
          return [];
        }),
        aiJobScraper.scrapeJobsWithAI().catch(err => {
          console.error('AI scraper error:', err);
          return [];
        })
      ]);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Scheduled scraping complete in ${totalTime}ms`);
    } catch (error) {
      console.error('Error in scheduled scraping:', error);
    }
  };
  
  // Schedule both scrapers to run every hour
  setInterval(scheduleAllScrapers, 60 * 60 * 1000);
  // Run once on startup
  scheduleAllScrapers();
  
  // Apply global API tracking
  app.use(trackApiUsage);

  // Configure Passport
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUser(username);
        if (!user) {
          return done(null, false, { message: "User not found" });
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  // Auth routes
  router.post("/api/register", rateLimitConfigs.auth, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword
      });
      res.json({ id: user.id, username: user.username });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/api/login", rateLimitConfigs.auth, (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed", message: err.message });
      }
      if (!user) {
        return res.status(401).json({ 
          error: "Invalid credentials", 
          message: info?.message || "Invalid username or password" 
        });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Session error:", err);
          return res.status(500).json({ error: "Login failed", message: "Session initialization failed" });
        }
        return res.json({ 
          id: user.id, 
          username: user.username,
          fullName: user.fullName
        });
      });
    })(req, res, next);
  });

  router.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  router.get("/api/me", requireAuth, (req, res) => {
    res.json(req.user);
  });

  // User profile routes
  router.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const updates = req.body;
      const user = await storage.updateUser(req.user!.id, updates);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Job listing routes
  router.get("/api/jobs", async (req, res) => {
    try {
      const { category, location, search } = req.query;
      const jobs = await storage.getJobListings({
        category: category as string,
        location: location as string,
        search: search as string
      });
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJobListing(parseInt(req.params.id));
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Manual job scraping endpoint (traditional RSS)
  router.post("/api/jobs/scrape", rateLimitConfigs.api, async (req, res) => {
    try {
      console.log('🔄 Starting manual RSS job scrape...');
      await jobScraper.scrapeAllJobs();
      const jobs = await storage.getJobListings({});
      res.json({ 
        success: true, 
        message: 'RSS job scraping completed successfully',
        totalJobs: jobs.length,
        source: 'RSS Feed Scraper'
      });
    } catch (error: any) {
      console.error('Error scraping RSS jobs:', error);
      res.status(500).json({ 
        error: 'Failed to scrape RSS jobs', 
        message: error.message 
      });
    }
  });

  // AI-powered job scraping endpoint
  router.post("/api/jobs/ai-scrape", rateLimitConfigs.aiAgent, async (req, res) => {
    const startTime = Date.now();
    
    try {
      console.log('🤖 Starting AI-powered job scrape...');
      
      // Run both traditional and AI scrapers in parallel
      const [rssResults, aiResults] = await Promise.all([
        jobScraper.scrapeAllJobs().catch(err => {
          console.error('RSS scraper error:', err);
          return { error: err.message, jobs: [] };
        }),
        aiJobScraper.scrapeJobsWithAI().catch(err => {
          console.error('AI scraper error:', err);
          return [];
        })
      ]);
      
      const processingTime = Date.now() - startTime;
      const allJobs = await storage.getJobListings({});
      
      res.json({ 
        success: true, 
        message: 'AI-powered job scraping completed successfully',
        results: {
          totalJobs: allJobs.length,
          aiJobsFound: aiResults.length,
          rssJobsFound: Array.isArray(rssResults) ? rssResults.length : 0,
          sources: ['RSS Feeds', 'OpenAI GPT', 'Google Gemini', 'Web Search'],
          aiProviders: ['OpenAI GPT-3.5', 'Google Gemini Pro'],
          processingTimeMs: processingTime,
          processingTimeSec: Math.round(processingTime / 1000)
        }
      });
    } catch (error: any) {
      console.error('Error in AI job scraping:', error);
      res.status(500).json({ 
        error: 'Failed to complete AI job scraping', 
        message: error.message,
        processingTimeMs: Date.now() - startTime
      });
    }
  });

  // AI-powered job search endpoint with custom parameters
  router.post("/api/jobs/ai-search", rateLimitConfigs.aiAgent, async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Validate request body
      const searchSchema = z.object({
        searchQuery: z.string().min(1).max(500),
        location: z.string().optional().default('Assam'),
        category: z.string().optional(),
        keywords: z.array(z.string()).optional().default([]),
        maxResults: z.number().min(1).max(50).optional().default(10)
      });
      
      const searchParams = searchSchema.parse(req.body);
      
      console.log('🔍 AI job search with params:', searchParams);
      
      // Build custom search query
      const customQuery = `${searchParams.searchQuery} ${searchParams.category || ''} in ${searchParams.location} ${searchParams.keywords.join(' ')}`.trim();
      
      // Create temporary AI scraper with custom search
      const customScraper = new AIJobScraperService(storage);
      
      // Override search queries for this request
      const originalQueries = (customScraper as any).SEARCH_QUERIES;
      (customScraper as any).SEARCH_QUERIES = [customQuery];
      
      // Perform AI search
      const searchResults = await customScraper.scrapeJobsWithAI();
      
      // Filter results based on max results parameter
      const limitedResults = searchResults.slice(0, searchParams.maxResults);
      
      const processingTime = Date.now() - startTime;
      
      res.json({ 
        success: true, 
        message: 'AI job search completed',
        searchParams,
        results: {
          jobsFound: limitedResults.length,
          jobs: limitedResults,
          aiProviders: ['OpenAI GPT-3.5', 'Google Gemini Pro'],
          processingTimeMs: processingTime,
          processingTimeSec: Math.round(processingTime / 1000)
        }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid search parameters', 
          details: error.errors,
          expectedFormat: {
            searchQuery: 'string (required)',
            location: 'string (optional, default: Assam)',
            category: 'string (optional)',
            keywords: 'array of strings (optional)',
            maxResults: 'number 1-50 (optional, default: 10)'
          }
        });
      }
      
      console.error('Error in AI job search:', error);
      res.status(500).json({ 
        error: 'Failed to complete AI job search', 
        message: error.message,
        processingTimeMs: Date.now() - startTime
      });
    }
  });

  // AI scraping status endpoint
  router.get("/api/jobs/ai-status", async (req, res) => {
    try {
      // Get current job counts
      const allJobs = await storage.getJobListings({});
      
      // Get jobs by source (we can filter by source field)
      const aiJobs = allJobs.filter((job: any) => 
        job.source?.includes('GPT') || 
        job.source?.includes('Gemini') || 
        job.source?.includes('AI')
      );
      
      const rssJobs = allJobs.filter((job: any) => 
        job.source?.includes('RSS') || 
        job.source?.includes('Feed')
      );
      
      // Get rate limit status if user is authenticated
      let rateLimitStatus = null;
      if (req.user) {
        rateLimitStatus = await getRateLimitStatus((req.user as any).id.toString(), 'ai');
      }
      
      res.json({ 
        success: true,
        status: {
          totalJobs: allJobs.length,
          jobsBySource: {
            ai: aiJobs.length,
            rss: rssJobs.length,
            other: allJobs.length - aiJobs.length - rssJobs.length
          },
          lastUpdate: new Date().toISOString(),
          nextScheduledScrape: new Date(Date.now() + (60 * 60 * 1000)).toISOString(),
          scrapers: {
            rss: {
              enabled: true,
              sources: ['GovtJobsBlog', 'NationalServices', 'SRPK', 'APSC'],
              interval: '60 minutes'
            },
            ai: {
              enabled: true,
              providers: ['OpenAI GPT-3.5', 'Google Gemini Pro'],
              features: ['Web Search', 'Content Extraction', 'Job Enrichment'],
              interval: '60 minutes'
            }
          },
          rateLimitStatus
        }
      });
    } catch (error: any) {
      console.error('Error getting AI status:', error);
      res.status(500).json({ 
        error: 'Failed to get AI scraping status', 
        message: error.message 
      });
    }
  });

  // Application routes
  router.get("/api/applications", requireAuth, async (req, res) => {
    try {
      const applications = await storage.getApplications(req.user!.id);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/applications/check/:jobId", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const existing = await storage.getApplicationByUserAndJob(req.user!.id, jobId);
      res.json({ hasApplied: !!existing });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/api/applications", requireAuth, async (req, res) => {
    try {
      const data = insertApplicationSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      // Check if already applied
      const existing = await storage.getApplicationByUserAndJob(req.user!.id, data.jobId);
      if (existing) {
        return res.status(400).json({ error: "Already applied to this job" });
      }
      
      const application = await storage.createApplication(data);
      res.json(application);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch("/api/applications/:id", requireAuth, async (req, res) => {
    try {
      const application = await storage.getApplication(parseInt(req.params.id));
      if (!application || application.userId !== req.user!.id) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      const updated = await storage.updateApplication(application.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI Chat routes
  router.get("/api/chat/messages", async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const sessionId = req.session.id;
      const messages = await storage.getChatMessages(userId, sessionId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/api/chat/message", rateLimitConfigs.aiAgent, async (req, res) => {
    try {
      const { content } = req.body;
      const userId = req.user?.id || null;
      const sessionId = req.session.id;
      
      // Save user message
      await storage.createChatMessage({
        userId,
        sessionId,
        content,
        isFromUser: true
      });

      // Get chat history for context
      const history = await storage.getChatMessages(userId, sessionId);
      
      // Prepare messages for OpenAI
      const messages: any[] = [
        {
          role: "system",
          content: `You are an AI assistant for a Teacher Job Portal in Assam. You help teachers find jobs, prepare for interviews, and advance their careers. You have access to functions for searching jobs, analyzing resumes, and more. Be helpful, professional, and encouraging.`
        }
      ];
      
      // Add recent history (last 10 messages)
      history.slice(-10).forEach(msg => {
        messages.push({
          role: msg.isFromUser ? "user" : "assistant",
          content: msg.content
        });
      });
      
      // Add current message
      messages.push({ role: "user", content });
      
      // Get AI response with function calling
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: agentFunctions.map(fn => ({
          type: "function" as const,
          function: {
            name: fn.name,
            description: fn.description,
            parameters: {
              type: "object",
              properties: fn.parameters.shape,
              required: Object.keys(fn.parameters.shape).filter(key => 
                !fn.parameters.shape[key].isOptional()
              )
            }
          }
        })),
        temperature: 0.7
      });
      
      const responseMessage = completion.choices[0].message;
      let finalResponse = responseMessage.content || "";
      
      // Handle function calls
      if (responseMessage.tool_calls) {
        const functionResults = [];
        
        for (const toolCall of responseMessage.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executeAgentFunction(
              toolCall.function.name,
              args,
              { storage, userId: userId || undefined }
            );
            functionResults.push({
              tool_call_id: toolCall.id,
              role: "tool" as const,
              content: JSON.stringify(result)
            });
          } catch (error: any) {
            functionResults.push({
              tool_call_id: toolCall.id,
              role: "tool" as const,
              content: JSON.stringify({ error: error.message })
            });
          }
        }
        
        // Get final response with function results
        const followUp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            ...messages,
            responseMessage,
            ...functionResults
          ],
          temperature: 0.7
        });
        
        finalResponse = followUp.choices[0].message.content || "";
      }
      
      // Save AI response
      const aiMessage = await storage.createChatMessage({
        userId,
        sessionId,
        content: finalResponse,
        isFromUser: false
      });
      
      res.json({
        id: aiMessage.id,
        content: finalResponse,
        isFromUser: false,
        timestamp: aiMessage.timestamp
      });
    } catch (error: any) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Documents routes
  router.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocuments(req.user!.id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Events routes
  router.get("/api/events", requireAuth, async (req, res) => {
    try {
      const events = await storage.getEvents(req.user!.id);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use(router);
  app.use("/api/ai", aiRoutes); // AI routes
  // app.use("/api/langchain", langchainRoutes); // LangChain routes - temporarily disabled due to errors
  app.use("/api/resume", resumeRoutes); // Resume routes
  app.use(vectorSearchRoutes); // Vector search routes
}