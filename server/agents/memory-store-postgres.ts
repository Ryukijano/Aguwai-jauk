import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Pool } from "pg";
import { storage } from "../storage";

// Production-ready PostgreSQL-based Memory Store
// Based on 2025 Best Practices for Agent Memory Management

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

interface TaskResult {
  agentName: string;
  task: string;
  result: string;
  confidence: number;
  metadata?: Record<string, any>;
}

// Create a connection pool for efficient database access
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export class PostgresMemoryStore {
  // Thread-level memory operations (short-term)
  static async saveThreadMemory(
    threadId: string,
    userId: string,
    messages: BaseMessage[],
    metadata: Record<string, any> = {},
    lastAgent?: string
  ): Promise<void> {
    try {
      // Serialize messages to JSONB format
      const serializedMessages = messages.map(msg => ({
        type: msg._getType(),
        content: msg.content,
        name: msg.name,
        additional_kwargs: msg.additional_kwargs
      }));

      const query = `
        INSERT INTO agent_thread_memory (thread_id, user_id, messages, metadata, last_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL '24 hours')
        ON CONFLICT (thread_id) 
        DO UPDATE SET 
          messages = $3,
          metadata = $4,
          last_agent = $5,
          updated_at = CURRENT_TIMESTAMP,
          expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours';
      `;

      await pool.query(query, [
        threadId,
        userId || null,
        JSON.stringify(serializedMessages),
        JSON.stringify(metadata),
        lastAgent
      ]);
    } catch (error) {
      console.error("Error saving thread memory:", error);
      throw error;
    }
  }

  static async getThreadMemory(threadId: string): Promise<Memory | null> {
    try {
      const query = `
        SELECT thread_id, user_id, messages, metadata, updated_at as timestamp
        FROM agent_thread_memory
        WHERE thread_id = $1 AND expires_at > CURRENT_TIMESTAMP;
      `;

      const result = await pool.query(query, [threadId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      // Deserialize messages back to BaseMessage instances
      const messages: BaseMessage[] = (row.messages || []).map((msg: any) => {
        if (msg.type === "human") {
          return new HumanMessage({ content: msg.content, name: msg.name });
        } else if (msg.type === "ai") {
          return new AIMessage({ content: msg.content, name: msg.name });
        } else if (msg.type === "system") {
          return new SystemMessage({ content: msg.content, name: msg.name });
        }
        return new HumanMessage({ content: msg.content });
      });

      return {
        threadId: row.thread_id,
        userId: row.user_id?.toString(),
        timestamp: row.timestamp,
        messages,
        metadata: row.metadata || {}
      };
    } catch (error) {
      console.error("Error getting thread memory:", error);
      return null;
    }
  }

  // User-level memory operations (long-term)
  static async saveUserProfile(userId: string, profile: Partial<UserProfile>): Promise<void> {
    try {
      const query = `
        INSERT INTO agent_user_profiles (
          user_id, 
          preferences, 
          resume_analyses, 
          search_history, 
          interview_history,
          last_active
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
          preferences = COALESCE($2, agent_user_profiles.preferences),
          resume_analyses = COALESCE($3, agent_user_profiles.resume_analyses),
          search_history = COALESCE($4, agent_user_profiles.search_history),
          interview_history = COALESCE($5, agent_user_profiles.interview_history),
          last_active = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP;
      `;

      await pool.query(query, [
        userId,
        profile.preferences ? JSON.stringify(profile.preferences) : null,
        profile.resumeAnalyses ? JSON.stringify(profile.resumeAnalyses) : null,
        profile.searchHistory ? JSON.stringify(profile.searchHistory) : null,
        profile.interviewHistory ? JSON.stringify(profile.interviewHistory) : null
      ]);
    } catch (error) {
      console.error("Error saving user profile:", error);
      throw error;
    }
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const query = `
        SELECT user_id, preferences, resume_analyses, search_history, interview_history
        FROM agent_user_profiles
        WHERE user_id = $1;
      `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id.toString(),
        preferences: row.preferences || {},
        resumeAnalyses: row.resume_analyses || [],
        searchHistory: row.search_history || [],
        interviewHistory: row.interview_history || []
      };
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  // Save resume analysis with importance scoring
  static async saveResumeAnalysis(userId: string, analysis: any): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current profile
      const profileResult = await client.query(
        "SELECT resume_analyses FROM agent_user_profiles WHERE user_id = $1",
        [userId]
      );

      let analyses = profileResult.rows[0]?.resume_analyses || [];
      
      // Add new analysis
      analyses.push({
        timestamp: new Date(),
        analysis
      });

      // Keep only last 10 analyses
      if (analyses.length > 10) {
        analyses = analyses.slice(-10);
      }

      // Update profile
      await client.query(
        `INSERT INTO agent_user_profiles (user_id, resume_analyses)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET 
         resume_analyses = $2, 
         updated_at = CURRENT_TIMESTAMP`,
        [userId, JSON.stringify(analyses)]
      );

      // Save as memory event with importance scoring
      const importance = analysis.score ? Math.min(analysis.score / 100, 1.0) : 0.5;
      await client.query(
        `INSERT INTO agent_memory_events (user_id, event_type, event_data, importance_score)
         VALUES ($1, 'resume_analysis', $2, $3)`,
        [userId, JSON.stringify(analysis), importance]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error saving resume analysis:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Save search history with query optimization
  static async saveSearchHistory(userId: string, query: any, results: any[] = []): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current profile
      const profileResult = await client.query(
        "SELECT search_history FROM agent_user_profiles WHERE user_id = $1",
        [userId]
      );

      let searches = profileResult.rows[0]?.search_history || [];
      
      // Add new search
      searches.push({
        timestamp: new Date(),
        query,
        results: results.map(r => r.id || r)
      });

      // Keep only last 20 searches
      if (searches.length > 20) {
        searches = searches.slice(-20);
      }

      // Update profile
      await client.query(
        `INSERT INTO agent_user_profiles (user_id, search_history)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET 
         search_history = $2, 
         updated_at = CURRENT_TIMESTAMP`,
        [userId, JSON.stringify(searches)]
      );

      // Save as memory event
      const importance = results.length > 0 ? 0.7 : 0.3;
      await client.query(
        `INSERT INTO agent_memory_events (user_id, event_type, event_data, importance_score)
         VALUES ($1, 'job_search', $2, $3)`,
        [userId, JSON.stringify({ query, resultCount: results.length }), importance]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error saving search history:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Save task results (ADK-style)
  static async saveTaskResult(
    userId: string | undefined,
    threadId: string | undefined,
    taskResult: TaskResult
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO agent_task_results (
          user_id, thread_id, agent_name, task, result, confidence, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `;

      await pool.query(query, [
        userId || null,
        threadId || null,
        taskResult.agentName,
        taskResult.task,
        taskResult.result,
        taskResult.confidence,
        JSON.stringify(taskResult.metadata || {})
      ]);
    } catch (error) {
      console.error("Error saving task result:", error);
      throw error;
    }
  }

  // Get user context for personalization
  static async getUserContext(userId: string): Promise<string> {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) return "";

      // Also get recent memory events for richer context
      const recentEventsQuery = `
        SELECT event_type, event_data, importance_score
        FROM agent_memory_events
        WHERE user_id = $1
        ORDER BY importance_score DESC, created_at DESC
        LIMIT 5;
      `;

      const eventsResult = await pool.query(recentEventsQuery, [userId]);

      let context = "User context:\n";

      // Add recent resume analyses
      if (profile.resumeAnalyses.length > 0) {
        const latestAnalysis = profile.resumeAnalyses[profile.resumeAnalyses.length - 1];
        const score = latestAnalysis.analysis?.score || latestAnalysis.analysis?.overallScore;
        if (score) {
          context += `- Latest resume score: ${score}/100 (${new Date(latestAnalysis.timestamp).toLocaleDateString()})\n`;
        }
      }

      // Add recent searches
      if (profile.searchHistory.length > 0) {
        const recentSearches = profile.searchHistory.slice(-3);
        const locations = recentSearches
          .map(s => s.query?.location)
          .filter(Boolean);
        if (locations.length > 0) {
          context += `- Recent search locations: ${locations.join(", ")}\n`;
        }
      }

      // Add high-importance events
      eventsResult.rows.forEach(event => {
        if (event.importance_score >= 0.7) {
          context += `- Important ${event.event_type.replace('_', ' ')}: `;
          if (event.event_type === 'resume_analysis' && event.event_data?.overallScore) {
            context += `Score ${event.event_data.overallScore}/100\n`;
          } else if (event.event_type === 'job_search' && event.event_data?.resultCount) {
            context += `Found ${event.event_data.resultCount} matches\n`;
          }
        }
      });

      // Add preferences
      if (Object.keys(profile.preferences).length > 0) {
        context += `- User preferences: ${JSON.stringify(profile.preferences)}\n`;
      }

      return context;
    } catch (error) {
      console.error("Error getting user context:", error);
      return "";
    }
  }

  // Save checkpoint for error recovery
  static async saveCheckpoint(
    threadId: string,
    agentName: string,
    checkpointData: any,
    stepNumber: number = 0
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO agent_checkpoints (thread_id, agent_name, checkpoint_data, step_number)
        VALUES ($1, $2, $3, $4);
      `;

      await pool.query(query, [
        threadId,
        agentName,
        JSON.stringify(checkpointData),
        stepNumber
      ]);
    } catch (error) {
      console.error("Error saving checkpoint:", error);
    }
  }

  // Get latest checkpoint for recovery
  static async getLatestCheckpoint(threadId: string): Promise<any | null> {
    try {
      const query = `
        SELECT checkpoint_data, agent_name, step_number
        FROM agent_checkpoints
        WHERE thread_id = $1
        ORDER BY created_at DESC
        LIMIT 1;
      `;

      const result = await pool.query(query, [threadId]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        data: result.rows[0].checkpoint_data,
        agentName: result.rows[0].agent_name,
        stepNumber: result.rows[0].step_number
      };
    } catch (error) {
      console.error("Error getting checkpoint:", error);
      return null;
    }
  }

  // Update memory event access count (for importance decay calculation)
  static async touchMemoryEvent(eventId: number): Promise<void> {
    try {
      const query = `
        UPDATE agent_memory_events 
        SET access_count = access_count + 1,
            last_accessed = CURRENT_TIMESTAMP
        WHERE id = $1;
      `;

      await pool.query(query, [eventId]);
    } catch (error) {
      console.error("Error updating memory event access:", error);
    }
  }

  // Cleanup old memories (scheduled task)
  static async cleanupOldMemories(): Promise<void> {
    try {
      // Delete expired thread memories
      await pool.query(
        "DELETE FROM agent_thread_memory WHERE expires_at < CURRENT_TIMESTAMP"
      );

      // Delete low-importance old events using retention score
      await pool.query(`
        DELETE FROM agent_memory_events 
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND importance_score < 0.3
        AND access_count < 5;
      `);

      // Archive old checkpoints
      await pool.query(
        "DELETE FROM agent_checkpoints WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '7 days'"
      );

      console.log("Memory cleanup completed successfully");
    } catch (error) {
      console.error("Error during memory cleanup:", error);
    }
  }

  // Get memory statistics for monitoring
  static async getMemoryStats(): Promise<any> {
    try {
      const stats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM agent_thread_memory) as active_threads,
          (SELECT COUNT(*) FROM agent_user_profiles) as user_profiles,
          (SELECT COUNT(*) FROM agent_memory_events) as memory_events,
          (SELECT AVG(importance_score) FROM agent_memory_events) as avg_importance,
          (SELECT COUNT(*) FROM agent_checkpoints) as checkpoints;
      `);

      return stats.rows[0];
    } catch (error) {
      console.error("Error getting memory stats:", error);
      return null;
    }
  }
}

// Run cleanup every 6 hours (production should use pg_cron or external scheduler)
if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    PostgresMemoryStore.cleanupOldMemories().catch(console.error);
  }, 6 * 60 * 60 * 1000);
}

// Export for backward compatibility
export const MemoryStore = PostgresMemoryStore;