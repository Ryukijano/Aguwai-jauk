import express from "express";
import multer from "multer";
import { storage } from "../storage";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { 
  createTeacherAssistant, 
  createThread, 
  addMessageToThread, 
  runAssistant, 
  getThreadMessages,
  uploadFile,
  processVoiceWithAssistant,
  processImageWithAssistant,
  processAgentMessage,
  processVoiceWithAgent,
  processImageWithAgent
} from "../openai-agents";

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

// Initialize assistant ID (will be set after creation)
let ASSISTANT_ID: string | null = null;

// Initialize and get the assistant
const getAssistant = async () => {
  if (!ASSISTANT_ID) {
    try {
      const assistant = await createTeacherAssistant();
      ASSISTANT_ID = assistant.id;
      console.log(`Created new assistant with ID: ${ASSISTANT_ID}`);
    } catch (error) {
      console.error("Failed to create assistant:", error);
      throw error;
    }
  }
  return ASSISTANT_ID;
};

// Store threads by session ID
const threadsBySession: Record<string, string> = {};

// Get or create thread for a session
const getThreadForSession = async (sessionId: string) => {
  if (!threadsBySession[sessionId]) {
    const thread = await createThread();
    threadsBySession[sessionId] = thread.id;
    console.log(`Created new thread for session ${sessionId}: ${thread.id}`);
  }
  return threadsBySession[sessionId];
};

// Text chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const sessionId = req.session.id || 'anonymous';
    console.log("Received chat message:", message, "Session ID:", sessionId);

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get assistant and thread
    console.log("Getting assistant...");
    const assistantId = await getAssistant();
    console.log("Assistant ID:", assistantId);

    console.log("Getting thread for session...");
    const threadId = await getThreadForSession(sessionId);
    console.log("Thread ID:", threadId);

    // Add message to thread
    console.log("Adding message to thread...");
    const addedMessage = await addMessageToThread(threadId, message);
    console.log("Message added:", addedMessage.id);

    // Run the assistant on the thread
    console.log("Running assistant on thread...");
    const messages = await runAssistant(assistantId, threadId);
    console.log("Assistant run completed with", messages.length, "messages");
    
    // Get the latest assistant message
    const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    console.log("Latest message found:", latestMessage ? latestMessage.id : "None");
    
    let content = "";
    if (latestMessage && latestMessage.content && latestMessage.content.length > 0) {
      // Handle text content
      const textContent = latestMessage.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        content = textContent.text.value;
        console.log("Extracted text content:", content.substring(0, 50) + (content.length > 50 ? "..." : ""));
      } else {
        console.log("No text content found in message:", latestMessage.content);
      }
    } else {
      console.log("No valid message content found");
    }

    // Store the messages in the database if a user is authenticated
    if (req.session?.userId) {
      await storage.createChatMessage({
        userId: req.session.userId,
        content: message,
        isFromUser: true,
      });

      await storage.createChatMessage({
        userId: req.session.userId,
        content: content,
        isFromUser: false,
      });
    }

    console.log("Sending response...");
    res.json({ 
      message: content,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("AI Chat Error:", error);
    console.error("Error stack:", error.stack);
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
    
    // Get assistant and thread
    const assistantId = await getAssistant();
    const threadId = await getThreadForSession(sessionId);
    
    // Upload the audio file
    const fileId = await uploadFile(req.file.path, "assistants_input");
    
    // Add message with audio to thread
    await addMessageToThread(threadId, "", [fileId]);
    
    // Run the assistant
    const messages = await runAssistant(assistantId, threadId);
    
    // Get the latest assistant message
    const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    let content = "";
    if (latestMessage && latestMessage.content && latestMessage.content.length > 0) {
      // Handle text content
      const textContent = latestMessage.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        content = textContent.text.value;
      }
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      message: content,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("Voice Chat Error:", error);
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
    
    // Get assistant and thread
    const assistantId = await getAssistant();
    const threadId = await getThreadForSession(sessionId);
    
    // Upload the image file
    const fileId = await uploadFile(req.file.path, "assistants_input");
    
    // Add message with image to thread
    await addMessageToThread(threadId, prompt, [fileId]);
    
    // Run the assistant
    const messages = await runAssistant(assistantId, threadId);
    
    // Get the latest assistant message
    const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    let content = "";
    if (latestMessage && latestMessage.content && latestMessage.content.length > 0) {
      // Handle text content
      const textContent = latestMessage.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        content = textContent.text.value;
      }
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      analysis: content,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("Image Analysis Error:", error);
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
    
    // Get assistant and thread
    const assistantId = await getAssistant();
    const threadId = await getThreadForSession(sessionId);
    
    // Upload the document file
    const fileId = await uploadFile(req.file.path, "assistants_input");
    
    // Create an appropriate prompt based on document type
    let prompt = "";
    if (documentType === 'resume') {
      prompt = "Please analyze this resume for a teaching position. Provide feedback on its strengths, weaknesses, and suggestions for improvement.";
    } else if (documentType === 'coverLetter') {
      prompt = "Please analyze this cover letter for a teaching position. Provide feedback on its effectiveness, structure, and suggestions for improvement.";
    }
    
    // Add message with document to thread
    await addMessageToThread(threadId, prompt, [fileId]);
    
    // Run the assistant
    const messages = await runAssistant(assistantId, threadId);
    
    // Get the latest assistant message
    const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    let content = "";
    if (latestMessage && latestMessage.content && latestMessage.content.length > 0) {
      // Handle text content
      const textContent = latestMessage.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        content = textContent.text.value;
      }
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      analysis: content,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("Document Analysis Error:", error);
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
    
    // Otherwise try to get from thread
    const sessionId = req.session.id || 'anonymous';
    if (threadsBySession[sessionId]) {
      const threadId = threadsBySession[sessionId];
      const messages = await getThreadMessages(threadId);
      
      // Convert to our format
      const formattedMessages = messages.map((msg: any, index: number) => {
        let content = "";
        if (msg.content && msg.content.length > 0) {
          const textContent = msg.content.find((c: any) => c.type === 'text');
          if (textContent && 'text' in textContent) {
            content = textContent.text.value;
          }
        }
        
        return {
          id: index + 1,
          content: content,
          isFromUser: msg.role === 'user',
          timestamp: new Date(msg.created_at * 1000).toISOString()
        };
      });
      
      return res.json(formattedMessages);
    }
    
    // No history found
    return res.json([]);
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
    
    // Create a new thread to effectively clear history
    const thread = await createThread();
    threadsBySession[sessionId] = thread.id;
    
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

// Advanced chat endpoint using the OpenAIAgent implementation
router.post("/advanced-chat", async (req, res) => {
  try {
    const { message } = req.body;
    const sessionId = req.session.id || 'anonymous';

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Process the message using the OpenAIAgent
    const result = await processAgentMessage(message);
    
    // Get the latest assistant message
    const assistantMessages = result.messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    // Store the thread ID for this session
    threadsBySession[sessionId] = result.threadId;
    
    // Store the messages in the database if a user is authenticated
    if (req.session?.userId) {
      await storage.createChatMessage({
        userId: req.session.userId,
        content: message,
        isFromUser: true,
      });

      await storage.createChatMessage({
        userId: req.session.userId,
        content: latestMessage.content || "",
        isFromUser: false,
      });
    }

    res.json({ 
      message: latestMessage.content || "",
      threadId: result.threadId,
      agentId: result.agentId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("Advanced AI Chat Error:", error);
    res.status(500).json({ 
      error: "Failed to process advanced chat message",
      details: error.message 
    });
  }
});

// Advanced voice chat endpoint using OpenAIAgent
router.post("/advanced-voice", upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    // Process the voice using the OpenAIAgent
    const result = await processVoiceWithAgent(req.file.path);
    
    // Get the latest assistant message
    const assistantMessages = result.messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      message: latestMessage.content || "",
      threadId: result.threadId,
      agentId: result.agentId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("Advanced Voice Chat Error:", error);
    res.status(500).json({ 
      error: "Failed to process advanced voice message",
      details: error.message 
    });
  }
});

// Advanced image analysis endpoint using OpenAIAgent
router.post("/advanced-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Analysis prompt is required" });
    }

    // Process the image using the OpenAIAgent
    const result = await processImageWithAgent(req.file.path, prompt);
    
    // Get the latest assistant message
    const assistantMessages = result.messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      analysis: latestMessage.content || "",
      threadId: result.threadId,
      agentId: result.agentId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("Advanced Image Analysis Error:", error);
    res.status(500).json({ 
      error: "Failed to analyze image with advanced techniques",
      details: error.message 
    });
  }
});

export default router;