import express, { type Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import session from "express-session";
import memorystore from "memorystore";
import { storage } from "./storage";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { 
  insertUserSchema, 
  insertJobListingSchema, 
  insertApplicationSchema,
  insertSocialLinkSchema,
  insertDocumentSchema,
  insertEventSchema,
  insertChatMessageSchema
} from "@shared/schema";
import { scrapeAssameseJobPortals } from "./scrapers";
import { 
  analyzeJobDescription, 
  generateInterviewQuestions, 
  getAIResponse,
  suggestResumeImprovements
} from "./openai";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  uploadFileToDrive,
  getFileFromDrive,
  deleteFileFromDrive,
  createJobTrackingSheet,
  appendJobToSheet,
  getJobTrackingData
} from "./googleApi";
import aiRoutes from "./routes/ai";


// Promisify scrypt
const scryptAsync = promisify(scrypt);

// Password hashing function
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Password comparison function
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Extend express session types
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

// Extend express request types
declare module "express" {
  interface Request {
    session: session.Session & { userId?: number };
  }
}

// Set up multer storage for file uploads
const storage_config = multer.memoryStorage();
const upload = multer({ 
  storage: storage_config,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up API routes
  const apiRouter = express.Router();
  app.use("/api", apiRouter);

  // Register the AI routes
  apiRouter.use("/ai", aiRoutes);

  // Enable sessions
  const MemoryStore = memorystore(session);

  // Configure session middleware before routes
  app.use(
    session({
      cookie: { maxAge: 86400000, secure: process.env.NODE_ENV === 'production' }, // 24 hours
      store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "aguwai-jauk-secret"
    })
  );

  // Authentication middleware with proper type checking
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // User routes with proper error handling
  apiRouter.post("/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);

      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password before storing
      const hashedPassword = await hashPassword(userData.password);

      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      if (req.session) {
        req.session.userId = user.id;
      }

      return res.status(201).json({ 
        id: user.id,
        username: user.username,
        name: user.name
      });
    } catch (error) {
      console.error("Register error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      let passwordValid = false;

      if (user.password.includes('.')) {
        // Hashed password with salt
        passwordValid = await comparePasswords(password, user.password);
      } else {
        // Plain text password (only for existing records)
        passwordValid = user.password === password;
      }

      if (!passwordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      if (req.session) {
        req.session.userId = user.id;
      }

      return res.status(200).json({ 
        id: user.id,
        username: user.username,
        name: user.name
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/auth/logout", (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.status(200).json({ message: "Logged out successfully" });
      });
    } else {
      res.status(200).json({ message: "Already logged out" });
    }
  });

  apiRouter.get("/auth/user", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.status(200).json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        qualifications: user.qualifications
      });
    } catch (error) {
      console.error("Get user error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.patch("/auth/user", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const updates = req.body;
      
      const user = await storage.updateUser(userId!, updates); // userId! is safe here because requireAuth ensures it's defined.

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.status(200).json({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        qualifications: user.qualifications
      });
    } catch (error) {
      console.error("Update user error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });
  
  // Job listing routes
  apiRouter.get("/jobs", async (req, res) => {
    try {
      const filters = req.query;
      const jobs = await storage.getJobListings(filters);
      return res.status(200).json(jobs);
    } catch (error) {
      console.error("Get jobs error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.get("/jobs/:id", async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const job = await storage.getJobListing(jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      return res.status(200).json(job);
    } catch (error) {
      console.error("Get job error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/jobs/scrape", async (req, res) => {
    try {
      const results = await scrapeAssameseJobPortals();
      const newJobs = [];
      
      for (const result of results) {
        for (const job of result.jobs) {
          const newJob = await storage.createJobListing(job);
          newJobs.push(newJob);
        }
      }
      
      return res.status(200).json({ 
        message: `Scraped ${newJobs.length} new job listings`,
        jobs: newJobs
      });
    } catch (error) {
      console.error("Job scraping error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // Application routes
  apiRouter.get("/applications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const applications = await storage.getUserApplications(userId!); // userId! is safe here because requireAuth ensures it's defined.
      return res.status(200).json(applications);
    } catch (error) {
      console.error("Get applications error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/applications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const applicationData = insertApplicationSchema.parse({
        ...req.body,
        userId: userId! // userId! is safe here because requireAuth ensures it's defined.
      });
      
      const application = await storage.createApplication(applicationData);
      return res.status(201).json(application);
    } catch (error) {
      console.error("Create application error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.patch("/applications/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const applicationId = parseInt(req.params.id);
      const updates = req.body;
      
      const application = await storage.getApplication(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      if (application.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const updatedApplication = await storage.updateApplication(applicationId, updates);
      return res.status(200).json(updatedApplication);
    } catch (error) {
      console.error("Update application error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // Social links routes
  apiRouter.get("/social-links", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const links = await storage.getUserSocialLinks(userId!); // userId! is safe here because requireAuth ensures it's defined.
      return res.status(200).json(links);
    } catch (error) {
      console.error("Get social links error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/social-links", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const linkData = insertSocialLinkSchema.parse({
        ...req.body,
        userId: userId! // userId! is safe here because requireAuth ensures it's defined.
      });
      
      const link = await storage.createSocialLink(linkData);
      return res.status(201).json(link);
    } catch (error) {
      console.error("Create social link error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.patch("/social-links/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const linkId = parseInt(req.params.id);
      const updates = req.body;
      
      const link = await storage.updateSocialLink(linkId, updates);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      if (link.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      return res.status(200).json(link);
    } catch (error) {
      console.error("Update social link error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.delete("/social-links/:id", requireAuth, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const deleted = await storage.deleteSocialLink(linkId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Link not found" });
      }
      
      return res.status(200).json({ message: "Link deleted successfully" });
    } catch (error) {
      console.error("Delete social link error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // Document routes
  apiRouter.get("/documents", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const documents = await storage.getUserDocuments(userId!); // userId! is safe here because requireAuth ensures it's defined.
      return res.status(200).json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/documents", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const userId = req.session.userId;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      
      // Upload to Google Drive (mock)
      const driveFile = await uploadFileToDrive(fileBuffer, fileName, mimeType);
      
      const documentData = insertDocumentSchema.parse({
        userId: userId!, // userId! is safe here because requireAuth ensures it's defined.
        name: fileName,
        fileUrl: driveFile.webViewLink,
        fileType: mimeType,
        category: req.body.category || "Other"
      });
      
      const document = await storage.createDocument(documentData);
      return res.status(201).json(document);
    } catch (error) {
      console.error("Upload document error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.delete("/documents/:id", requireAuth, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const deleted = await storage.deleteDocument(documentId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      return res.status(200).json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Delete document error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/documents/analyze-resume", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Convert buffer to string (would use proper text extraction for PDFs in production)
      const resumeText = req.file.buffer.toString('utf-8');
      
      const analysis = await suggestResumeImprovements(resumeText);
      return res.status(200).json(analysis);
    } catch (error) {
      console.error("Resume analysis error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // Event routes
  apiRouter.get("/events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const events = await storage.getUserEvents(userId!); // userId! is safe here because requireAuth ensures it's defined.
      return res.status(200).json(events);
    } catch (error) {
      console.error("Get events error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/events", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const eventData = insertEventSchema.parse({
        ...req.body,
        userId: userId! // userId! is safe here because requireAuth ensures it's defined.
      });
      
      // Create Google Calendar event (mock)
      const googleEvent = await createCalendarEvent(eventData);
      
      const event = await storage.createEvent({
        ...eventData,
        googleCalendarId: googleEvent.id
      });
      
      return res.status(201).json(event);
    } catch (error) {
      console.error("Create event error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.patch("/events/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const eventId = parseInt(req.params.id);
      const updates = req.body;
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if (event.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (event.googleCalendarId) {
        await updateCalendarEvent(event.googleCalendarId, updates);
      }
      
      const updatedEvent = await storage.updateEvent(eventId, updates);
      return res.status(200).json(updatedEvent);
    } catch (error) {
      console.error("Update event error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.delete("/events/:id", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if (event.googleCalendarId) {
        await deleteCalendarEvent(event.googleCalendarId);
      }
      
      const deleted = await storage.deleteEvent(eventId);
      
      if (!deleted) {
        return res.status(400).json({ message: "Failed to delete event" });
      }
      
      return res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Delete event error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // Google Calendar integration
  apiRouter.get("/calendar/sync", requireAuth, async (req, res) => {
    try {
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 1); // 1 month ahead
      
      const events = await listCalendarEvents(timeMin, timeMax);
      return res.status(200).json(events);
    } catch (error) {
      console.error("Calendar sync error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // Job tracking with Google Sheets
  apiRouter.get("/job-tracker", requireAuth, async (req, res) => {
    try {
      // In a real app, would store the sheet ID in the user profile
      const sheetId = "mock_sheet_id";
      const trackingData = await getJobTrackingData(sheetId);
      return res.status(200).json(trackingData);
    } catch (error) {
      console.error("Job tracker error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/job-tracker", requireAuth, async (req, res) => {
    try {
      // In a real app, would store the sheet ID in the user profile
      const sheetId = "mock_sheet_id";
      await appendJobToSheet(sheetId, req.body);
      return res.status(200).json({ message: "Job added to tracker" });
    } catch (error) {
      console.error("Job tracker add error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  // AI routes
  apiRouter.post("/ai/analyze-job", async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description) {
        return res.status(400).json({ message: "Job description required" });
      }
      
      const analysis = await analyzeJobDescription(description);
      return res.status(200).json(analysis);
    } catch (error) {
      console.error("Job analysis error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/ai/interview-questions", async (req, res) => {
    try {
      const jobDetails = req.body;
      
      if (!jobDetails.title || !jobDetails.organization) {
        return res.status(400).json({ message: "Job details required" });
      }
      
      const questions = await generateInterviewQuestions(jobDetails);
      return res.status(200).json({ questions });
    } catch (error) {
      console.error("Interview questions error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.post("/ai/chat", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message text required" });
      }
      
      // Save user message
      await storage.createChatMessage({
        userId: userId!, // userId! is safe here because requireAuth ensures it's defined.
        content: message,
        isFromUser: true
      });
      
      // Get AI response
      const aiResponse = await getAIResponse(userId!, message);
      
      // Save AI response
      const savedResponse = await storage.createChatMessage({
        userId: userId!, // userId! is safe here because requireAuth ensures it's defined.
        content: aiResponse,
        isFromUser: false
      });
      
      return res.status(200).json(savedResponse);
    } catch (error) {
      console.error("AI chat error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  apiRouter.get("/ai/chat-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const messages = await storage.getUserChatMessages(userId!); // userId! is safe here because requireAuth ensures it's defined.
      return res.status(200).json(messages);
    } catch (error) {
      console.error("Chat history error:", error);
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "An unexpected error occurred" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import { Request, Response, NextFunction } from "express";