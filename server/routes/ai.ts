import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import express from "express";
import type { ChatMessage } from "@shared/schema";
import { storage } from "../storage";

const router = express.Router();

// Initialize ChatOpenAI with API key from environment
const chatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// Define the system prompt
const systemPrompt = 
  "You are an AI Assistant for the Aguwai Jauk - a specialized job portal for teachers in Assam, India.\n\n" +
  "Your primary role is to provide personalized guidance to teachers looking for jobs in Assam. You offer:\n\n" +
  "1. Job search assistance: Help users find relevant teaching positions based on their qualifications, location preferences, and career goals.\n" +
  "2. Application advice: Provide guidance on preparing resumes, writing effective cover letters, and submitting strong applications.\n" +
  "3. Interview preparation: Offer tips on common interview questions for teaching positions and strategies for demonstrating teaching skills.\n" +
  "4. Career development: Suggest professional development opportunities, certifications, and skills that can enhance a teacher's prospects.\n" +
  "5. Regional insights: Share information about educational institutions, living conditions, and cultural aspects of different regions in Assam.\n\n" +
  "Always be respectful, culturally sensitive, and focus on providing accurate, practical information to help teachers advance their careers in Assam's education sector.";

// Create a conversation chain with memory
const memory = new BufferMemory();
const chain = new ConversationChain({
  llm: chatModel,
  memory: memory,
  prompt: {
    template: systemPrompt + "\n\nCurrent conversation:\n{history}\nHuman: {input}\nAI: ",
    inputVariables: ["history", "input"],
  },
});

// Chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Call the chain
    const response = await chain.call({
      input: message,
    });

    // Store the message in the database if a user is authenticated
    if (req.session?.userId) {
      await storage.createChatMessage({
        userId: req.session.userId,
        content: message,
        isFromUser: true,
        timestamp: new Date().toISOString(),
      });

      await storage.createChatMessage({
        userId: req.session.userId,
        content: response.response,
        isFromUser: false,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ 
      message: response.response,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const error = err as Error;
    console.error("AI Chat Error:", error);
    res.status(500).json({ 
      error: "Failed to process chat message",
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
    
    // Otherwise get from memory
    const history = await memory.chatHistory.getMessages();
    const formattedHistory = history.map((msg, index) => ({
      id: index + 1,
      content: msg.content as string,
      isFromUser: msg._getType() === "human",
      timestamp: new Date().toISOString()
    }));

    res.json(formattedHistory);
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
    await memory.clear();
    
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