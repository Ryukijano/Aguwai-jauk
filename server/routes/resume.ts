import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
// Authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};
import { processMultiAgentChat } from "../agents/langgraph-orchestrator";
import { MemoryStore } from "../agents/memory-store";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Set up multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Analyze resume with Gemini-powered multi-agent system
router.post("/analyze", requireAuth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume file is required" });
    }

    const userId = req.session?.userId;
    
    // Read the file content
    const resumeContent = fs.readFileSync(req.file.path, 'utf-8');
    
    // Process through multi-agent system with resume analyzer
    const result = await processMultiAgentChat(
      `Please analyze this resume for teaching positions in Assam:\n\n${resumeContent}`,
      userId
    );

    // Extract analysis from response
    const analysisMatch = result.response.match(/\*\*Overall Match Score\*\*: (\d+)\/100/);
    const score = analysisMatch ? parseInt(analysisMatch[1]) : 0;

    // Save to user profile
    if (userId) {
      await MemoryStore.saveResumeAnalysis(userId, {
        score,
        fullAnalysis: result.response,
        timestamp: new Date()
      });
    }

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      analysis: result.response,
      score,
      threadId: result.threadId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Resume analysis error:", error);
    
    // Clean up file if it exists
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

// Get analysis history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const profile = await MemoryStore.getUserProfile(userId);
    const history = profile?.resumeAnalyses || [];

    res.json({
      analyses: history,
      total: history.length
    });
  } catch (error) {
    console.error("Failed to get resume history:", error);
    res.status(500).json({ error: "Failed to retrieve history" });
  }
});

export default router;