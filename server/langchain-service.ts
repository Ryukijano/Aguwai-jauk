import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { storage } from "./storage";
import { z } from "zod";

// Specify the tools/actions that our agent can use
const toolsSchema = z.union([
  z.object({
    tool: z.literal("search_jobs"),
    toolInput: z.object({
      location: z.string().optional(),
      subject: z.string().optional(),
      jobType: z.string().optional(),
      schoolType: z.string().optional(),
    }),
  }),
  z.object({
    tool: z.literal("analyze_document"),
    toolInput: z.object({
      documentType: z.enum(["resume", "coverLetter"]),
      documentContent: z.string(),
    }),
  }),
  z.object({
    tool: z.literal("generate_interview_questions"),
    toolInput: z.object({
      position: z.string(),
      schoolType: z.string().optional(),
      experienceLevel: z.string().optional(),
    }),
  }),
  z.object({
    tool: z.literal("final_answer"),
    toolInput: z.object({
      answer: z.string(),
    }),
  }),
]);

// Define the state of our graph
type AgentState = {
  messages: { role: string; content: string }[];
  action?: {
    tool: string;
    toolInput: any;
  };
  observation?: string;
  shouldContinue?: boolean;
};

// Tool implementations
async function searchJobs(input: any): Promise<string> {
  try {
    const filters: any = {};
    if (input.location) filters.location = input.location;
    if (input.subject && input.subject.toLowerCase().includes("math")) {
      filters.tags = ["Mathematics"];
    }
    if (input.schoolType === "government") {
      filters.category = "Government";
    } else if (input.schoolType === "private") {
      filters.category = "Private";
    }
    
    const jobs = await storage.getJobListings(filters);
    
    if (jobs.length === 0) {
      return "No matching jobs found. Try broadening your search criteria.";
    }
    
    return jobs.map(job => `
    Position: ${job.title}
    Organization: ${job.organization}
    Location: ${job.location}
    Salary: ${job.salary}
    Requirements: ${job.requirements}
    Application Deadline: ${new Date(job.applicationDeadline).toLocaleDateString()}
    `).join("\n---\n");
  } catch (error) {
    console.error("Error searching jobs:", error);
    return "There was an error searching for jobs. Please try again.";
  }
}

async function analyzeDocument(input: any): Promise<string> {
  try {
    const { documentType, documentContent } = input;
    const model = new ChatOpenAI({ 
      modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      temperature: 0.2
    });
    
    let systemPrompt = "";
    if (documentType === "resume") {
      systemPrompt = `You're an expert resume reviewer for teaching positions in Assam, India. 
      Analyze this resume for a teaching position and provide specific, actionable feedback on:
      1. Overall structure and presentation
      2. How well qualifications match teaching requirements in Assam
      3. Areas that can be improved to increase chances of getting teaching interviews
      4. Specific suggestions for highlighting teaching skills and certifications`;
    } else {
      systemPrompt = `You're an expert cover letter reviewer for teaching positions in Assam, India.
      Analyze this cover letter for a teaching position and provide specific, actionable feedback on:
      1. Overall tone and persuasiveness
      2. How well it addresses the specific needs of schools in Assam
      3. Any cultural considerations that would improve it
      4. Specific suggestions for demonstrating passion for teaching and education`;
    }
    
    const result = await model.invoke([
      ["system", systemPrompt],
      ["user", documentContent]
    ]);
    
    return result.content.toString();
  } catch (error) {
    console.error(`Error analyzing ${input.documentType}:`, error);
    return `There was an error analyzing your ${input.documentType}. Please try again.`;
  }
}

async function generateInterviewQuestions(input: any): Promise<string> {
  try {
    const { position, schoolType, experienceLevel } = input;
    
    const model = new ChatOpenAI({ 
      modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      temperature: 0.7
    });
    
    const systemPrompt = `You're an expert on teacher interviews in Assam, India. 
    Generate 5-7 realistic interview questions for a ${position} position 
    ${schoolType ? `at a ${schoolType} school` : ""} 
    ${experienceLevel ? `for candidates with ${experienceLevel} experience` : ""}. 
    Include questions about:
    1. Teaching methodology
    2. Classroom management
    3. Subject expertise
    4. Understanding of the local Assam education context
    5. Cultural awareness and language considerations`;
    
    const result = await model.invoke([
      ["system", systemPrompt],
      ["user", `Generate interview questions for a ${position} position in Assam.`]
    ]);
    
    return result.content.toString();
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return "There was an error generating interview questions. Please try again.";
  }
}

// LangGraph implementation
export class AssistantGraph {
  private model: ChatOpenAI;
  private graph: StateGraph<AgentState>;

  constructor() {
    this.model = new ChatOpenAI({ 
      modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      temperature: 0.2
    });
    
    this.graph = this.buildGraph();
  }

  private buildGraph(): StateGraph<AgentState> {
    // Create our agent state graph
    const graph = new StateGraph<AgentState>({ 
      channels: {
        messages: {
          value: async (x: AgentState) => x.messages,
          default: () => []
        },
        action: {
          value: async (x: AgentState) => x.action,
          default: () => undefined
        },
        observation: {
          value: async (x: AgentState) => x.observation,
          default: () => undefined
        },
        shouldContinue: {
          value: async (x: AgentState) => x.shouldContinue,
          default: () => true
        }
      }
    });

    // Define our agent thinking node
    const agentNode = this.createAgentNode();
    graph.addNode("agent", agentNode);

    // Define action nodes for each tool
    graph.addNode("search_jobs", this.createToolNode(searchJobs));
    graph.addNode("analyze_document", this.createToolNode(analyzeDocument));
    graph.addNode("generate_interview_questions", this.createToolNode(generateInterviewQuestions));
    
    // Add a final answer node
    graph.addNode("final_answer", RunnableSequence.from([
      async (state: AgentState) => {
        return {
          ...state,
          shouldContinue: false,
          messages: [
            ...state.messages,
            {
              role: "assistant",
              content: state.action?.toolInput.answer || "I don't have an answer at this time."
            }
          ]
        };
      }
    ]));

    // Define the conditional routing logic
    graph.addEdge("agent", this.createRouter());

    // Create connections from tools back to agent
    graph.addEdge("search_jobs", "agent");
    graph.addEdge("analyze_document", "agent");
    graph.addEdge("generate_interview_questions", "agent");
    
    // Set the entry point
    graph.setEntryPoint("agent");
    
    // Set final_answer as an end state
    graph.addConditionalEdges(
      "final_answer",
      (state) => state.shouldContinue ? "agent" : undefined
    );

    return graph;
  }

  private createAgentNode() {
    const systemPrompt = `You are an AI Assistant for Aguwai Jauk - a specialized job portal for teachers in Assam, India.

Your primary role is to provide personalized guidance to teachers looking for jobs in Assam. You offer:

1. Job search assistance: Help users find relevant teaching positions based on their qualifications, location preferences, and career goals.
2. Application advice: Provide guidance on preparing resumes, writing effective cover letters, and submitting strong applications.
3. Interview preparation: Offer tips on common interview questions for teaching positions and strategies for demonstrating teaching skills.
4. Career development: Suggest professional development opportunities, certifications, and skills that can enhance a teacher's prospects.
5. Regional insights: Share information about educational institutions, living conditions, and cultural aspects of different regions in Assam.

Always be respectful, culturally sensitive, and focus on providing accurate, practical information to help teachers advance their careers in Assam's education sector.

You have access to tools that can help you provide information to the user. Use them only when appropriate.

If you need to search for jobs, use the search_jobs tool with appropriate parameters.
If you need to analyze a document, use the analyze_document tool.
If you need to generate interview questions, use the generate_interview_questions tool.
When you have a final answer to provide to the user, use the final_answer tool.`;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      { role: "system", content: systemPrompt },
      { role: "human", content: (input) => this.formatMessagesForPrompt(input.messages) },
    ]);

    const agentNode = RunnableSequence.from([
      {
        messages: (state: AgentState) => state.messages,
        observation: (state: AgentState) => state.observation,
      },
      async (input) => ({
        messages: input.messages,
        messageText: this.formatMessagesForPrompt(input.messages),
        observation: input.observation ? `\nObservation: ${input.observation}` : "",
      }),
      {
        prompt: (formattedInput) => 
          promptTemplate.format({
            messages: formattedInput.messageText + formattedInput.observation
          })
      },
      this.model.bind({ response_format: { type: "json_object" } }),
      // Parse the model output
      async (modelOutput) => {
        try {
          const content = typeof modelOutput.content === 'string' 
            ? modelOutput.content 
            : JSON.stringify(modelOutput.content);
          
          const parsed = JSON.parse(content);
          
          if (parsed.tool === "final_answer") {
            return {
              action: {
                tool: "final_answer",
                toolInput: { answer: parsed.toolInput.answer }
              }
            };
          } else if (parsed.tool && parsed.toolInput) {
            return {
              action: {
                tool: parsed.tool,
                toolInput: parsed.toolInput
              }
            };
          } else {
            // Default to final answer if we can't parse the output properly
            return {
              action: {
                tool: "final_answer",
                toolInput: { answer: content }
              }
            };
          }
        } catch (e) {
          console.error("Error parsing model output:", e);
          return {
            action: {
              tool: "final_answer",
              toolInput: { 
                answer: "I'm having trouble understanding how to help you. Could you rephrase your question?" 
              }
            }
          };
        }
      }
    ]);

    return agentNode;
  }

  private createToolNode(toolFn: (input: any) => Promise<string>) {
    return RunnableSequence.from([
      async (state: AgentState) => {
        if (!state.action?.toolInput) {
          throw new Error("No tool input provided");
        }
        
        const observation = await toolFn(state.action.toolInput);
        
        return {
          ...state,
          observation,
          action: undefined, // Clear the action
        };
      }
    ]);
  }

  private createRouter() {
    return (state: AgentState) => {
      if (!state.action) {
        return "final_answer";
      }
      
      const { tool } = state.action;
      
      switch (tool) {
        case "search_jobs":
          return "search_jobs";
        case "analyze_document":
          return "analyze_document";
        case "generate_interview_questions":
          return "generate_interview_questions";
        case "final_answer":
          return "final_answer";
        default:
          console.warn(`Unknown tool: ${tool}`);
          return "final_answer";
      }
    };
  }

  private formatMessagesForPrompt(messages: { role: string; content: string }[]): string {
    return messages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
  }

  // Public method to process a user message
  async processMessage(userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
    try {
      // Add the user message to history
      const messages = [...history, { role: "user", content: userMessage }];
      
      // Run the graph with the updated messages
      const result = await this.graph.invoke({ messages });
      
      // Get the last assistant message
      const assistantMessages = result.messages.filter(msg => msg.role === "assistant");
      const lastMessage = assistantMessages[assistantMessages.length - 1];
      
      return lastMessage?.content || "I don't have a response at this time.";
    } catch (error) {
      console.error("Error processing message:", error);
      return "I encountered an error while processing your message. Please try again.";
    }
  }

  // For voice processing (simplified for now)
  async processVoice(transcription: string, history: { role: string; content: string }[] = []): Promise<string> {
    return this.processMessage(transcription, history);
  }

  // For image analysis 
  async analyzeImage(imageDescription: string, prompt: string, history: { role: string; content: string }[] = []): Promise<string> {
    const combinedMessage = `[Image description: ${imageDescription}]\n\nUser question about the image: ${prompt}`;
    return this.processMessage(combinedMessage, history);
  }
}

// Create a singleton instance
export const assistantGraph = new AssistantGraph();