import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { OpenAIEmbeddings } from "@langchain/openai";
import { WeaviateStore } from "@langchain/weaviate";
import { Document } from "@langchain/core/documents";

// Weaviate Cloud configuration
// Using Weaviate Cloud Sandbox (free tier) for development
const WEAVIATE_URL = process.env.WEAVIATE_URL || "https://teacher-portal-4u2rkxqs.weaviate.network";
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY || "demo-key"; // Replace with actual key in production
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize Weaviate client
let client: WeaviateClient | null = null;
let vectorStore: WeaviateStore | null = null;
let embeddings: OpenAIEmbeddings | null = null;

// Collection names for different memory types
const COLLECTIONS = {
  USER_MEMORIES: "UserMemories",
  RESUME_ANALYSES: "ResumeAnalyses",
  JOB_SEARCHES: "JobSearches",
  CONVERSATIONS: "Conversations"
};

// Initialize Weaviate connection
export async function initializeWeaviate() {
  try {
    // Initialize Weaviate client
    client = weaviate.client({
      scheme: 'https',
      host: WEAVIATE_URL.replace('https://', '').replace('http://', ''),
      apiKey: new ApiKey(WEAVIATE_API_KEY),
      headers: { 'X-OpenAI-Api-Key': OPENAI_API_KEY || '' }
    });

    // Test connection (skip if using demo key)
    if (WEAVIATE_API_KEY !== "demo-key") {
      try {
        const isReady = await client.misc.readyChecker().do();
        if (!isReady) {
          throw new Error("Weaviate is not ready");
        }
      } catch (error) {
        console.warn("⚠️ Weaviate connection test failed, continuing without vector store");
        return false;
      }
    }

    // Initialize OpenAI embeddings
    embeddings = new OpenAIEmbeddings({
      apiKey: OPENAI_API_KEY,
      model: "text-embedding-3-small", // Using latest smaller, faster model
      dimensions: 1536
    });

    // Initialize vector store for user memories
    vectorStore = await WeaviateStore.fromExistingIndex(embeddings, {
      client: client as any,
      indexName: COLLECTIONS.USER_MEMORIES,
      textKey: "text",
      metadataKeys: ["userId", "type", "timestamp", "importance"]
    });

    // Create schemas if they don't exist
    await createSchemas();

    console.log("✅ Weaviate vector store initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Weaviate:", error);
    // Fallback to local operation if Weaviate is not available
    return false;
  }
}

// Create Weaviate schemas for different collections
async function createSchemas() {
  if (!client) return;

  try {
    // Check if schemas already exist
    const existingSchemas = await client.schema.getter().do();
    const existingClassNames = existingSchemas.classes?.map(c => c.class) || [];

    // User Memories schema
    if (!existingClassNames.includes(COLLECTIONS.USER_MEMORIES)) {
      await client.schema.classCreator().withClass({
        class: COLLECTIONS.USER_MEMORIES,
        description: "User memory events with embeddings",
        vectorizer: "text2vec-openai",
        moduleConfig: {
          "text2vec-openai": {
            model: "text-embedding-3-small",
            type: "text"
          }
        },
        properties: [
          {
            name: "text",
            dataType: ["text"],
            description: "The memory content"
          },
          {
            name: "userId",
            dataType: ["string"],
            description: "User identifier"
          },
          {
            name: "type",
            dataType: ["string"],
            description: "Memory type (conversation, analysis, search)"
          },
          {
            name: "timestamp",
            dataType: ["date"],
            description: "When the memory was created"
          },
          {
            name: "importance",
            dataType: ["number"],
            description: "Importance score (0-1)"
          },
          {
            name: "metadata",
            dataType: ["text"],
            description: "Additional metadata as JSON"
          }
        ]
      }).do();
    }

    // Resume Analyses schema
    if (!existingClassNames.includes(COLLECTIONS.RESUME_ANALYSES)) {
      await client.schema.classCreator().withClass({
        class: COLLECTIONS.RESUME_ANALYSES,
        description: "Resume analysis results with semantic search",
        vectorizer: "text2vec-openai",
        properties: [
          {
            name: "text",
            dataType: ["text"],
            description: "Resume content and analysis"
          },
          {
            name: "userId",
            dataType: ["string"]
          },
          {
            name: "score",
            dataType: ["number"]
          },
          {
            name: "skills",
            dataType: ["text[]"]
          },
          {
            name: "recommendations",
            dataType: ["text"]
          }
        ]
      }).do();
    }

    // Job Searches schema
    if (!existingClassNames.includes(COLLECTIONS.JOB_SEARCHES)) {
      await client.schema.classCreator().withClass({
        class: COLLECTIONS.JOB_SEARCHES,
        description: "Job search queries and results",
        vectorizer: "text2vec-openai",
        properties: [
          {
            name: "text",
            dataType: ["text"],
            description: "Search query and context"
          },
          {
            name: "userId",
            dataType: ["string"]
          },
          {
            name: "location",
            dataType: ["string"]
          },
          {
            name: "category",
            dataType: ["string"]
          },
          {
            name: "resultCount",
            dataType: ["int"]
          }
        ]
      }).do();
    }

    console.log("✅ Weaviate schemas created/verified");
  } catch (error) {
    console.error("Error creating schemas:", error);
  }
}

// Store memory with embeddings
export async function storeMemoryWithEmbedding(
  userId: string,
  text: string,
  type: string,
  importance: number = 0.5,
  metadata: any = {}
): Promise<string | null> {
  try {
    if (!vectorStore || !embeddings) {
      console.warn("Vector store not initialized, falling back to database only");
      return null;
    }

    const document = new Document({
      pageContent: text,
      metadata: {
        userId,
        type,
        timestamp: new Date().toISOString(),
        importance,
        ...metadata
      }
    });

    const ids = await vectorStore.addDocuments([document]);
    console.log(`✅ Stored memory with embedding for user ${userId}`);
    return ids[0];
  } catch (error) {
    console.error("Error storing memory with embedding:", error);
    return null;
  }
}

// Semantic search for similar memories
export async function searchSimilarMemories(
  query: string,
  userId?: string,
  limit: number = 5,
  type?: string
): Promise<Array<{ content: string; metadata: any; score: number }>> {
  try {
    if (!vectorStore) {
      console.warn("Vector store not initialized");
      return [];
    }

    // Build filter
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (type) filter.type = type;

    // Perform similarity search
    const results = await vectorStore.similaritySearchWithScore(
      query,
      limit,
      filter
    );

    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata,
      score: 1 - score // Convert distance to similarity score
    }));
  } catch (error) {
    console.error("Error searching similar memories:", error);
    return [];
  }
}

// Store resume analysis with embeddings
export async function storeResumeAnalysisEmbedding(
  userId: string,
  resumeText: string,
  analysis: any
): Promise<void> {
  try {
    if (!client) return;

    const fullText = `Resume: ${resumeText}\n\nAnalysis: ${JSON.stringify(analysis)}`;
    
    await storeMemoryWithEmbedding(
      userId,
      fullText,
      "resume_analysis",
      analysis.confidence || 0.8,
      {
        score: analysis.overallScore,
        skills: analysis.skills || [],
        recommendations: analysis.recommendations || []
      }
    );
  } catch (error) {
    console.error("Error storing resume analysis embedding:", error);
  }
}

// Store conversation with embeddings
export async function storeConversationEmbedding(
  userId: string,
  conversation: string,
  topic: string,
  sentiment: string
): Promise<void> {
  try {
    await storeMemoryWithEmbedding(
      userId,
      conversation,
      "conversation",
      0.6,
      { topic, sentiment }
    );
  } catch (error) {
    console.error("Error storing conversation embedding:", error);
  }
}

// Get relevant context for a user query
export async function getRelevantContext(
  userId: string,
  query: string,
  limit: number = 3
): Promise<string> {
  try {
    const memories = await searchSimilarMemories(query, userId, limit);
    
    if (memories.length === 0) {
      return "";
    }

    let context = "Relevant context from user history:\n";
    memories.forEach((memory, index) => {
      context += `${index + 1}. [Score: ${(memory.score * 100).toFixed(0)}%] ${memory.content.substring(0, 200)}...\n`;
    });

    return context;
  } catch (error) {
    console.error("Error getting relevant context:", error);
    return "";
  }
}

// Delete user memories (for GDPR compliance)
export async function deleteUserMemories(userId: string): Promise<void> {
  try {
    if (!client) return;

    // Delete from all collections
    for (const collectionName of Object.values(COLLECTIONS)) {
      await client.batch
        .objectsBatchDeleter()
        .withClassName(collectionName)
        .withWhere({
          path: ["userId"],
          operator: "Equal",
          valueString: userId
        })
        .do();
    }

    console.log(`✅ Deleted all memories for user ${userId}`);
  } catch (error) {
    console.error("Error deleting user memories:", error);
  }
}

// Get embedding for text (useful for other operations)
export async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    if (!embeddings) {
      console.warn("Embeddings not initialized");
      return null;
    }

    const embedding = await embeddings.embedQuery(text);
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

// Initialize on module load
initializeWeaviate().catch(console.error);