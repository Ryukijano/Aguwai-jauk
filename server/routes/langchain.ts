import express from "express";
import multer from "multer";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { assistantGraph } from "../langchain-service";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Set up multer for file uploads (voice and image)
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Store chat history by session ID
const messageHistoryBySession: Record<string, { role: string; content: string }[]> = {};

// Text chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const sessionId = req.session.id || 'anonymous';

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get existing message history or initialize empty
    if (!messageHistoryBySession[sessionId]) {
      messageHistoryBySession[sessionId] = [];
    }
    const history = messageHistoryBySession[sessionId];

    // Process the message with LangGraph
    const response = await assistantGraph.processMessage(message, history);

    // Store messages in history
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: response });
    
    // Keep history to a reasonable size (optional)
    if (history.length > 20) {
      // Remove oldest messages while keeping an even number of messages
      const excessMessages = history.length - 20;
      history.splice(0, excessMessages - (excessMessages % 2));
    }

    // Store in database if user is authenticated
    if (req.session?.userId) {
      await storage.createChatMessage({
        userId: req.session.userId,
        content: message,
        isFromUser: true,
      });

      await storage.createChatMessage({
        userId: req.session.userId,
        content: response,
        isFromUser: false,
      });
    }

    res.json({ 
      message: response,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("LangChain Chat Error:", error);
    res.status(500).json({ 
      error: "Failed to process chat message",
      details: error.message 
    });
  }
});

// Voice chat endpoint
router.post("/voice", upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    const sessionId = req.session.id || 'anonymous';
    
    // This is a simplified version - in a real app, you'd use a speech-to-text service
    // For now, let's assume the audio contains a simple question about teaching jobs
    const transcription = "I'm looking for teaching jobs in Assam";
    
    // Get existing message history
    if (!messageHistoryBySession[sessionId]) {
      messageHistoryBySession[sessionId] = [];
    }
    const history = messageHistoryBySession[sessionId];
    
    // Process the transcription
    const response = await assistantGraph.processVoice(transcription, history);
    
    // Update history
    history.push({ role: "user", content: `[Voice message]: ${transcription}` });
    history.push({ role: "assistant", content: response });
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      message: response,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("LangChain Voice Error:", error);
    res.status(500).json({ 
      error: "Failed to process voice message",
      details: error.message 
    });
  }
});

// Image analysis endpoint
router.post("/analyze-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Analysis prompt is required" });
    }

    const sessionId = req.session.id || 'anonymous';
    
    // Simplified version - in a real app, you'd use image analysis AI
    // For now, let's create a placeholder description
    const imageDescription = "An image that appears to be a teaching certificate or document";
    
    // Get existing message history
    if (!messageHistoryBySession[sessionId]) {
      messageHistoryBySession[sessionId] = [];
    }
    const history = messageHistoryBySession[sessionId];
    
    // Process the image analysis
    const response = await assistantGraph.analyzeImage(imageDescription, prompt, history);
    
    // Update history
    history.push({ role: "user", content: `[Image uploaded with question]: ${prompt}` });
    history.push({ role: "assistant", content: response });
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      analysis: response,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("LangChain Image Analysis Error:", error);
    res.status(500).json({ 
      error: "Failed to analyze image",
      details: error.message 
    });
  }
});

// Document analysis endpoint (resume, cover letter)
router.post("/analyze-document", upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Document file is required" });
    }

    const { documentType } = req.body; // 'resume' or 'coverLetter'
    if (!documentType) {
      return res.status(400).json({ error: "Document type is required" });
    }

    const sessionId = req.session.id || 'anonymous';
    
    // In a real app, you'd extract text from the document
    // For now, let's use a placeholder content
    const documentContent = "Sample resume content for a teacher in Assam...";
    
    // Get existing message history
    if (!messageHistoryBySession[sessionId]) {
      messageHistoryBySession[sessionId] = [];
    }
    const history = messageHistoryBySession[sessionId];
    
    // Direct tool usage for document analysis
    const response = await assistantGraph.processMessage(
      `Please analyze this ${documentType}: ${documentContent}`, 
      history
    );
    
    // Update history
    history.push({ role: "user", content: `[${documentType} uploaded for analysis]` });
    history.push({ role: "assistant", content: response });
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      analysis: response,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("LangChain Document Analysis Error:", error);
    res.status(500).json({ 
      error: "Failed to analyze document",
      details: error.message 
    });
  }
});

// Get chat history
router.get("/chat-history", async (req, res) => {
  try {
    // If user is authenticated, get history from database
    if (req.session?.userId) {
      const messages = await storage.getUserChatMessages(req.session.userId);
      return res.json(messages);
    }
    
    // Otherwise try to get from in-memory history
    const sessionId = req.session.id || 'anonymous';
    const history = messageHistoryBySession[sessionId] || [];
    
    // Convert to our standard format
    const formattedMessages = history.map((msg, index) => ({
      id: index + 1,
      content: msg.content,
      isFromUser: msg.role === "user",
      timestamp: new Date().toISOString() // We don't have timestamps in memory, using current time
    }));
    
    return res.json(formattedMessages);
  } catch (err) {
    const error = err as Error;
    console.error("Chat History Error:", error);
    res.status(500).json({ 
      error: "Failed to fetch chat history",
      details: error.message 
    });
  }
});

// Clear chat history
router.delete("/chat-history", async (req, res) => {
  try {
    const sessionId = req.session.id || 'anonymous';
    
    // Clear in-memory history
    messageHistoryBySession[sessionId] = [];
    
    // If user is authenticated, clear from database too
    if (req.session?.userId) {
      // This is just a placeholder as we don't have a method to delete all messages
      // You would implement a proper method in storage.ts to delete all messages for a user
    }
    
    res.json({ message: "Chat history cleared successfully" });
  } catch (err) {
    const error = err as Error;
    console.error("Clear Chat History Error:", error);
    res.status(500).json({ 
      error: "Failed to clear chat history",
      details: error.message 
    });
  }
});

export default router;