import { StateGraph, MemorySaver, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";

// Initialize AI clients with latest models
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const langchainOpenAI = new ChatOpenAI({ 
  model: "gpt-4o",
  temperature: 0.3,
  apiKey: process.env.OPENAI_API_KEY 
});
const langchainGemini = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.3,
  apiKey: process.env.GEMINI_API_KEY
});

// Define agent state using Annotation
const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  userId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  currentAgent: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  context: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  resumeAnalysis: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  jobSearchResults: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  interviewPrep: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  memory: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});

// Define tool schemas
const JobSearchSchema = z.object({
  location: z.string().optional(),
  jobType: z.string().optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

const ResumeAnalysisSchema = z.object({
  resumeContent: z.string(),
  targetJobId: z.string().optional(),
});

const InterviewPrepSchema = z.object({
  jobTitle: z.string(),
  school: z.string(),
  category: z.string().optional(),
});

// Supervisor Agent - Orchestrates other agents
async function supervisorAgent(state: typeof AgentStateAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage.content as string;
  
  // Use OpenAI's new Responses API with web search for enhanced context
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a supervisor agent orchestrating specialized agents for a teacher job portal.
        
Available agents:
1. resume_analyzer - Analyzes teaching resumes using Google's Gemini
2. job_searcher - Searches for teaching jobs in Assam
3. interview_prepper - Prepares interview questions and tips
4. conversationalist - General conversation and guidance

Based on the user's message, decide which agent to invoke. Respond with JSON:
{
  "agent": "agent_name",
  "reasoning": "why this agent is chosen",
  "parameters": { ... }
}`
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    response_format: { type: "json_object" }
  });

  const decision = JSON.parse(response.choices[0].message.content || "{}");
  
  return {
    currentAgent: decision.agent,
    context: {
      ...state.context,
      supervisorDecision: decision
    },
    messages: [
      ...state.messages,
      new AIMessage({
        content: `Routing to ${decision.agent} agent...`,
        name: "supervisor"
      })
    ]
  };
}

// Resume Analyzer Agent - Uses Google's ADK patterns with Gemini
async function resumeAnalyzerAgent(state: typeof AgentStateAnnotation.State) {
  const supervisorDecision = state.context?.supervisorDecision;
  const resumeContent = supervisorDecision?.parameters?.resumeContent || "";
  
  // Use Google's ADK-style agent with thinking capabilities
  const model = genAI.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: `You are an expert resume analyzer specializing in teaching positions in Assam.
      
Analyze resumes with deep understanding of:
- Educational qualifications (B.Ed, M.Ed, TET, CTET certifications)
- Teaching experience in government/private schools
- Subject expertise and language proficiency (Assamese, English, Hindi)
- Extra-curricular activities and achievements
- Alignment with Assam education system requirements`,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          overallScore: { type: "number", minimum: 0, maximum: 100 },
          strengths: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                detail: { type: "string" },
                impact: { type: "string", enum: ["high", "medium", "low"] }
              }
            }
          },
          weaknesses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                detail: { type: "string" },
                suggestion: { type: "string" }
              }
            }
          },
          recommendations: {
            type: "array",
            items: { type: "string" }
          },
          suitablePositions: {
            type: "array",
            items: { type: "string" }
          },
          assamSpecificAdvice: { type: "string" }
        }
      }
    },
    contents: `Analyze this teaching resume for positions in Assam:\n\n${resumeContent}`
  });
  
  const analysis = await model;
  const analysisData = JSON.parse(analysis.text || "{}");
  
  return {
    resumeAnalysis: analysisData,
    messages: [
      ...state.messages,
      new AIMessage({
        content: `I've analyzed your resume. Here's my detailed assessment:

**Overall Match Score**: ${analysisData.overallScore}/100

**Key Strengths**:
${analysisData.strengths.map((s: any) => `• ${s.detail} (${s.impact} impact)`).join('\n')}

**Areas for Improvement**:
${analysisData.weaknesses.map((w: any) => `• ${w.detail}\n  💡 ${w.suggestion}`).join('\n')}

**Recommendations**:
${analysisData.recommendations.map((r: string) => `• ${r}`).join('\n')}

**Suitable Positions**:
${analysisData.suitablePositions.map((p: string) => `• ${p}`).join('\n')}

**Assam-Specific Advice**:
${analysisData.assamSpecificAdvice}`,
        name: "resume_analyzer"
      })
    ]
  };
}

// Job Search Agent - Searches and filters jobs
async function jobSearchAgent(state: typeof AgentStateAnnotation.State) {
  const supervisorDecision = state.context?.supervisorDecision;
  const searchParams = supervisorDecision?.parameters || {};
  
  // Search jobs from storage
  const allJobs = await storage.getJobListings();
  
  // Apply filters based on parameters
  let filteredJobs = allJobs;
  
  if (searchParams.location) {
    filteredJobs = filteredJobs.filter(job => 
      job.location.toLowerCase().includes(searchParams.location.toLowerCase())
    );
  }
  
  if (searchParams.jobType) {
    filteredJobs = filteredJobs.filter(job => 
      job.jobType === searchParams.jobType
    );
  }
  
  if (searchParams.category) {
    filteredJobs = filteredJobs.filter(job => 
      job.category === searchParams.category
    );
  }
  
  if (searchParams.keywords && searchParams.keywords.length > 0) {
    filteredJobs = filteredJobs.filter(job => {
      const jobText = `${job.title} ${job.description} ${job.organization}`.toLowerCase();
      return searchParams.keywords.some((keyword: string) => 
        jobText.includes(keyword.toLowerCase())
      );
    });
  }
  
  // Use Gemini to rank and analyze the jobs
  const jobAnalysis = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Analyze and rank these teaching jobs for relevance and quality:
    
${JSON.stringify(filteredJobs.slice(0, 10), null, 2)}

Provide insights on:
1. Which positions are most promising
2. Salary competitiveness
3. Growth opportunities
4. Work-life balance indicators`
  });
  
  return {
    jobSearchResults: filteredJobs.slice(0, 10),
    messages: [
      ...state.messages,
      new AIMessage({
        content: `Found ${filteredJobs.length} teaching positions matching your criteria. ${jobAnalysis.text}`,
        name: "job_searcher"
      })
    ]
  };
}

// Interview Prep Agent - Generates interview questions and tips
async function interviewPrepAgent(state: typeof AgentStateAnnotation.State) {
  const supervisorDecision = state.context?.supervisorDecision;
  const { jobTitle, school, category } = supervisorDecision?.parameters || {};
  
  // Use OpenAI's new framework for interview preparation
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert interview coach for teaching positions in Assam. 
        Generate comprehensive interview preparation including common questions, 
        best answers, and cultural considerations for schools in Assam.`
      },
      {
        role: "user",
        content: `Prepare me for a ${jobTitle} interview at ${school} in the ${category || 'General'} category.`
      }
    ],
    response_format: { type: "json_object" }
  });
  
  const prep = JSON.parse(response.choices[0].message.content || "{}");
  
  return {
    interviewPrep: prep,
    messages: [
      ...state.messages,
      new AIMessage({
        content: `I've prepared comprehensive interview guidance for ${jobTitle} at ${school}. ${JSON.stringify(prep, null, 2)}`,
        name: "interview_prepper"
      })
    ]
  };
}

// Conversational Agent - General assistance
async function conversationalAgent(state: typeof AgentStateAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 2]; // Get user's message
  
  const response = await langchainOpenAI.invoke([
    new SystemMessage("You are a helpful AI assistant for teachers in Assam seeking job opportunities."),
    ...state.messages
  ]);
  
  return {
    messages: [
      ...state.messages,
      new AIMessage({
        content: response.content as string,
        name: "conversationalist"
      })
    ]
  };
}

// Create the LangGraph workflow
export function createMultiAgentGraph() {
  // Initialize the graph with our state schema
  const workflow = new StateGraph(AgentStateAnnotation);
  
  // Add nodes for each agent - must use __start__ and __end__ format
  const nodeNames = {
    supervisor: "supervisor",
    resume: "resume_analyzer", 
    search: "job_searcher",
    interview: "interview_prepper",
    chat: "conversationalist"
  };
  
  workflow.addNode(nodeNames.supervisor, supervisorAgent);
  workflow.addNode(nodeNames.resume, resumeAnalyzerAgent);
  workflow.addNode(nodeNames.search, jobSearchAgent);
  workflow.addNode(nodeNames.interview, interviewPrepAgent);
  workflow.addNode(nodeNames.chat, conversationalAgent);
  
  // Define the flow - start with supervisor
  workflow.addEdge("__start__", nodeNames.supervisor);
  
  // Add conditional edges based on supervisor decision
  workflow.addConditionalEdges(
    nodeNames.supervisor,
    async (state) => {
      const agent = state.currentAgent || "conversationalist";
      // Map agent names to node names
      const mapping: Record<string, string> = {
        "resume_analyzer": nodeNames.resume,
        "job_searcher": nodeNames.search,
        "interview_prepper": nodeNames.interview,
        "conversationalist": nodeNames.chat
      };
      return mapping[agent] || nodeNames.chat;
    }
  );
  
  // All agents return to END
  workflow.addEdge(nodeNames.resume, "__end__");
  workflow.addEdge(nodeNames.search, "__end__");
  workflow.addEdge(nodeNames.interview, "__end__");
  workflow.addEdge(nodeNames.chat, "__end__");
  
  // Add memory persistence
  const checkpointer = new MemorySaver();
  
  // Compile the graph
  return workflow.compile({ checkpointer });
}

// Main function to process messages
export async function processMultiAgentChat(
  message: string,
  userId?: string,
  threadId?: string
): Promise<{ response: string; threadId: string }> {
  const graph = createMultiAgentGraph();
  
  // Create configuration with thread ID for memory persistence
  const config = {
    configurable: {
      thread_id: threadId || `user-${userId}-${Date.now()}`
    }
  };
  
  // Invoke the graph
  const result = await graph.invoke(
    {
      messages: [new HumanMessage(message)],
      userId,
      context: {},
      memory: {}
    },
    config
  );
  
  // Get the last AI message as response
  const aiMessages = result.messages.filter((m: BaseMessage) => m._getType() === "ai");
  const lastAiMessage = aiMessages[aiMessages.length - 1];
  
  return {
    response: lastAiMessage.content as string,
    threadId: config.configurable.thread_id
  };
}