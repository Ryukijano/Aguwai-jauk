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

export function setupRoutes(app: Express, storage: IStorage) {
  const router = Router();

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
  router.post("/api/register", async (req, res) => {
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

  router.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({ 
      id: req.user!.id, 
      username: req.user!.username,
      fullName: req.user!.fullName
    });
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

  router.post("/api/chat/message", async (req, res) => {
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
}