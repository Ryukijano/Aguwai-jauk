import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import express from "express";
import type { ChatMessage } from "@shared/schema";

const router = express.Router();

// Initialize ChatOpenAI with API key from environment
const chatModel = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// Create a conversation chain with memory
const memory = new BufferMemory();
const chain = new ConversationChain({
  llm: chatModel,
  memory: memory,
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

export default router;