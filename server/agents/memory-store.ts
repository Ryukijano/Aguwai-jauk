import { BaseMessage } from "@langchain/core/messages";
import { storage } from "../storage";

interface Memory {
  userId: string;
  threadId: string;
  timestamp: Date;
  messages: BaseMessage[];
  metadata: Record<string, any>;
}

interface UserProfile {
  userId: string;
  preferences: Record<string, any>;
  resumeAnalyses: Array<{
    timestamp: Date;
    analysis: any;
  }>;
  searchHistory: Array<{
    timestamp: Date;
    query: any;
    results: any[];
  }>;
  interviewHistory: Array<{
    timestamp: Date;
    prep: any;
  }>;
}

// In-memory stores (in production, use Redis or PostgreSQL)
const threadMemory = new Map<string, Memory>();
const userProfiles = new Map<string, UserProfile>();

export class MemoryStore {
  // Thread-level memory (short-term)
  static async saveThreadMemory(
    threadId: string,
    userId: string,
    messages: BaseMessage[],
    metadata: Record<string, any> = {}
  ): Promise<void> {
    threadMemory.set(threadId, {
      userId,
      threadId,
      timestamp: new Date(),
      messages,
      metadata
    });
  }
  
  static async getThreadMemory(threadId: string): Promise<Memory | null> {
    return threadMemory.get(threadId) || null;
  }
  
  // User-level memory (long-term)
  static async saveUserProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
    const existing = userProfiles.get(userId) || {
      userId,
      preferences: {},
      resumeAnalyses: [],
      searchHistory: [],
      interviewHistory: []
    };
    
    userProfiles.set(userId, {
      ...existing,
      ...profile
    });
  }
  
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    return userProfiles.get(userId) || null;
  }
  
  // Save resume analysis to user profile
  static async saveResumeAnalysis(userId: string, analysis: any): Promise<void> {
    const profile = await this.getUserProfile(userId) || {
      userId,
      preferences: {},
      resumeAnalyses: [],
      searchHistory: [],
      interviewHistory: []
    };
    
    profile.resumeAnalyses.push({
      timestamp: new Date(),
      analysis
    });
    
    // Keep only last 10 analyses
    if (profile.resumeAnalyses.length > 10) {
      profile.resumeAnalyses = profile.resumeAnalyses.slice(-10);
    }
    
    await this.saveUserProfile(userId, profile);
  }
  
  // Save search history
  static async saveSearchHistory(userId: string, query: any, results: any[]): Promise<void> {
    const profile = await this.getUserProfile(userId) || {
      userId,
      preferences: {},
      resumeAnalyses: [],
      searchHistory: [],
      interviewHistory: []
    };
    
    profile.searchHistory.push({
      timestamp: new Date(),
      query,
      results
    });
    
    // Keep only last 20 searches
    if (profile.searchHistory.length > 20) {
      profile.searchHistory = profile.searchHistory.slice(-20);
    }
    
    await this.saveUserProfile(userId, profile);
  }
  
  // Get conversation context for a user
  static async getUserContext(userId: string): Promise<string> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return "";
    
    let context = "User context:\n";
    
    // Add recent resume analyses
    if (profile.resumeAnalyses.length > 0) {
      const latestAnalysis = profile.resumeAnalyses[profile.resumeAnalyses.length - 1];
      context += `- Latest resume analysis (${latestAnalysis.timestamp.toLocaleDateString()}): Score ${latestAnalysis.analysis.overallScore}/100\n`;
    }
    
    // Add recent searches
    if (profile.searchHistory.length > 0) {
      const recentSearches = profile.searchHistory.slice(-3);
      context += `- Recent job searches: ${recentSearches.map(s => s.query.location || "All locations").join(", ")}\n`;
    }
    
    // Add preferences
    if (Object.keys(profile.preferences).length > 0) {
      context += `- Preferences: ${JSON.stringify(profile.preferences)}\n`;
    }
    
    return context;
  }
  
  // Clear old memories (cleanup)
  static async cleanupOldMemories(): Promise<void> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Clean up thread memories older than 24 hours
    for (const [threadId, memory] of threadMemory.entries()) {
      if (memory.timestamp < dayAgo) {
        threadMemory.delete(threadId);
      }
    }
  }
}

// Run cleanup every hour
setInterval(() => {
  MemoryStore.cleanupOldMemories();
}, 60 * 60 * 1000);