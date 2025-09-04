import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';
import { wrapOpenAI } from 'langsmith/wrappers';
import OpenAI from 'openai';
import { BaseMessage } from '@langchain/core/messages';

// Initialize LangSmith client
let langsmithClient: Client | null = null;
let isLangSmithEnabled = false;

// Project configuration
const PROJECT_NAME = process.env.LANGSMITH_PROJECT || "teacher-portal-agents";
const LANGSMITH_API_KEY = process.env.LANGSMITH_API_KEY;
const LANGSMITH_ENDPOINT = process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com";

// Initialize LangSmith
export async function initializeLangSmith() {
  try {
    if (!LANGSMITH_API_KEY) {
      console.warn("⚠️ LANGSMITH_API_KEY not set, observability disabled");
      return false;
    }

    // Set environment variables for LangChain
    process.env.LANGCHAIN_TRACING_V2 = "true";
    process.env.LANGCHAIN_API_KEY = LANGSMITH_API_KEY;
    process.env.LANGCHAIN_PROJECT = PROJECT_NAME;
    process.env.LANGCHAIN_ENDPOINT = LANGSMITH_ENDPOINT;

    langsmithClient = new Client({
      apiUrl: LANGSMITH_ENDPOINT,
      apiKey: LANGSMITH_API_KEY
    });

    // Test connection
    const projects = await langsmithClient.listProjects();
    
    // Create project if it doesn't exist
    const projectExists = projects.some(p => p.name === PROJECT_NAME);
    if (!projectExists) {
      await langsmithClient.createProject({
        projectName: PROJECT_NAME,
        description: "Teacher Portal Multi-Agent System Traces"
      });
    }

    isLangSmithEnabled = true;
    console.log(`✅ LangSmith observability initialized for project: ${PROJECT_NAME}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize LangSmith:", error);
    isLangSmithEnabled = false;
    return false;
  }
}

// Wrap OpenAI client with LangSmith tracing
export function getTracedOpenAI(): OpenAI {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  if (isLangSmithEnabled) {
    return wrapOpenAI(openai);
  }
  
  return openai;
}

// Custom trace decorator for agent functions
export function traceAgent(agentName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!isLangSmithEnabled) {
        return originalMethod.apply(this, args);
      }

      const runId = generateRunId();
      const startTime = Date.now();
      
      try {
        // Log start of agent execution
        await logAgentStart(agentName, propertyName, args, runId);
        
        // Execute original method
        const result = await originalMethod.apply(this, args);
        
        // Log successful completion
        await logAgentSuccess(agentName, propertyName, result, Date.now() - startTime, runId);
        
        return result;
      } catch (error) {
        // Log error
        await logAgentError(agentName, propertyName, error, Date.now() - startTime, runId);
        throw error;
      }
    };

    return descriptor;
  };
}

// Traceable wrapper for functions (alternative to decorator)
export const traceableAgent = (agentName: string, metadata?: Record<string, any>) => {
  return traceable(async (fn: Function, ...args: any[]) => {
    return await fn(...args);
  }, {
    name: agentName,
    run_type: "agent",
    project_name: PROJECT_NAME,
    metadata: metadata || {}
  });
};

// Log agent conversation flow
export async function traceConversation(
  threadId: string,
  userId: string,
  messages: BaseMessage[],
  agentFlow: string[]
) {
  if (!langsmithClient || !isLangSmithEnabled) return;

  try {
    const run = {
      name: "conversation_flow",
      run_type: "chain" as const,
      inputs: {
        threadId,
        userId,
        messageCount: messages.length,
        firstMessage: messages[0]?.content
      },
      outputs: {
        agentFlow,
        lastMessage: messages[messages.length - 1]?.content
      },
      tags: ["conversation", `user:${userId}`],
      metadata: {
        threadId,
        agentCount: agentFlow.length,
        timestamp: new Date().toISOString()
      }
    };

    await langsmithClient.createRun(run);
  } catch (error) {
    console.error("Error tracing conversation:", error);
  }
}

// Log agent performance metrics
export async function logAgentMetrics(
  agentName: string,
  metrics: {
    duration: number;
    tokensUsed?: number;
    confidence?: number;
    cacheHit?: boolean;
  }
) {
  if (!langsmithClient || !isLangSmithEnabled) return;

  try {
    const run = {
      name: `${agentName}_metrics`,
      run_type: "tool" as const,
      inputs: { agent: agentName },
      outputs: metrics,
      tags: ["metrics", agentName],
      metadata: {
        timestamp: new Date().toISOString(),
        ...metrics
      }
    };

    await langsmithClient.createRun(run);
  } catch (error) {
    console.error("Error logging agent metrics:", error);
  }
}

// Log memory operations
export async function traceMemoryOperation(
  operation: string,
  userId: string,
  data: any,
  success: boolean
) {
  if (!langsmithClient || !isLangSmithEnabled) return;

  try {
    const run = {
      name: `memory_${operation}`,
      run_type: "tool" as const,
      inputs: {
        operation,
        userId,
        dataSize: JSON.stringify(data).length
      },
      outputs: { success },
      tags: ["memory", operation],
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    await langsmithClient.createRun(run);
  } catch (error) {
    console.error("Error tracing memory operation:", error);
  }
}

// Create feedback for a run (for quality tracking)
export async function createFeedback(
  runId: string,
  score: number,
  comment?: string
) {
  if (!langsmithClient || !isLangSmithEnabled) return;

  try {
    await langsmithClient.createFeedback(
      runId,
      "user_rating",
      {
        score,
        comment
      }
    );
  } catch (error) {
    console.error("Error creating feedback:", error);
  }
}

// Get trace URL for debugging
export function getTraceUrl(runId: string): string {
  if (!isLangSmithEnabled) return "";
  return `${LANGSMITH_ENDPOINT}/public/${LANGSMITH_API_KEY}/r/${runId}`;
}

// Helper functions
function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function logAgentStart(agentName: string, method: string, args: any[], runId: string) {
  if (!langsmithClient) return;
  
  try {
    const run = {
      id: runId,
      name: `${agentName}.${method}`,
      run_type: "agent" as const,
      inputs: {
        method,
        argsCount: args.length,
        preview: JSON.stringify(args[0]).substring(0, 100)
      },
      tags: [agentName, method],
      metadata: {
        startTime: new Date().toISOString()
      }
    };

    await langsmithClient.createRun(run);
  } catch (error) {
    // Silently fail to not block agent execution
  }
}

async function logAgentSuccess(agentName: string, method: string, result: any, duration: number, runId: string) {
  if (!langsmithClient) return;
  
  try {
    await langsmithClient.updateRun(runId, {
      outputs: {
        success: true,
        resultPreview: JSON.stringify(result).substring(0, 200)
      },
      end_time: new Date().toISOString(),
      metadata: {
        duration,
        status: "success"
      }
    });
  } catch (error) {
    // Silently fail
  }
}

async function logAgentError(agentName: string, method: string, error: any, duration: number, runId: string) {
  if (!langsmithClient) return;
  
  try {
    await langsmithClient.updateRun(runId, {
      outputs: {
        success: false,
        error: error.message || "Unknown error"
      },
      error: error.message,
      end_time: new Date().toISOString(),
      metadata: {
        duration,
        status: "error",
        errorStack: error.stack
      }
    });
  } catch (error) {
    // Silently fail
  }
}

// Export traced functions for agent operations
export const tracedFunctions = {
  // Trace resume analysis
  analyzeResume: traceable(async (resumeContent: string, userId: string) => {
    // This will be wrapped around the actual resume analysis function
    return { traced: true };
  }, {
    name: "analyze_resume",
    run_type: "agent",
    project_name: PROJECT_NAME
  }),

  // Trace job search
  searchJobs: traceable(async (query: any, userId: string) => {
    return { traced: true };
  }, {
    name: "search_jobs",
    run_type: "agent",
    project_name: PROJECT_NAME
  }),

  // Trace interview prep
  prepareInterview: traceable(async (jobTitle: string, userId: string) => {
    return { traced: true };
  }, {
    name: "prepare_interview",
    run_type: "agent",
    project_name: PROJECT_NAME
  })
};

// Dashboard metrics aggregator
export async function getAgentMetrics(timeRange: { start: Date; end: Date }) {
  if (!langsmithClient || !isLangSmithEnabled) {
    return {
      totalRuns: 0,
      successRate: 0,
      avgDuration: 0,
      agentBreakdown: {}
    };
  }

  try {
    // Query runs within time range
    const runs = await langsmithClient.listRuns({
      projectName: PROJECT_NAME,
      startTime: timeRange.start.toISOString(),
      endTime: timeRange.end.toISOString()
    });

    // Aggregate metrics
    const metrics = {
      totalRuns: runs.length,
      successRate: 0,
      avgDuration: 0,
      agentBreakdown: {} as Record<string, number>
    };

    let successCount = 0;
    let totalDuration = 0;

    for (const run of runs) {
      if (run.status === "success") successCount++;
      if (run.latency) totalDuration += run.latency;
      
      const agentName = run.name.split('.')[0];
      metrics.agentBreakdown[agentName] = (metrics.agentBreakdown[agentName] || 0) + 1;
    }

    metrics.successRate = runs.length > 0 ? (successCount / runs.length) * 100 : 0;
    metrics.avgDuration = runs.length > 0 ? totalDuration / runs.length : 0;

    return metrics;
  } catch (error) {
    console.error("Error fetching agent metrics:", error);
    return {
      totalRuns: 0,
      successRate: 0,
      avgDuration: 0,
      agentBreakdown: {}
    };
  }
}

// Initialize on module load
initializeLangSmith().catch(console.error);