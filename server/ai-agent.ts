import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { generateObject } from "openai-function-calling-tools";
import { z } from "zod";
import { storage } from "./storage";

// Initialize AI clients
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define tool schemas for OpenAI function calling
const JobSearchSchema = z.object({
  location: z.string().optional(),
  jobType: z.string().optional(),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

const ResumeAnalysisSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  matchScore: z.number().min(0).max(100),
});

const InterviewPrepSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    category: z.string(),
    tips: z.string(),
  })),
  generalAdvice: z.string(),
});

// Define available tools
const tools = [
  {
    name: "search_jobs",
    description: "Search for teaching jobs based on criteria",
    parameters: JobSearchSchema,
  },
  {
    name: "analyze_resume",
    description: "Analyze a resume for strengths and improvements",
    parameters: z.object({
      resumeText: z.string(),
    }),
  },
  {
    name: "prepare_interview",
    description: "Generate interview questions and preparation tips",
    parameters: z.object({
      jobTitle: z.string(),
      schoolType: z.string().optional(),
    }),
  },
  {
    name: "track_application",
    description: "Get application status for a specific job",
    parameters: z.object({
      jobId: z.number(),
    }),
  },
];

// Tool execution functions
async function searchJobs(params: z.infer<typeof JobSearchSchema>) {
  try {
    // Search jobs in the database
    const jobs = await storage.getAllJobs();
    
    // Filter based on criteria
    let filteredJobs = jobs;
    
    if (params.location) {
      filteredJobs = filteredJobs.filter(job => 
        job.location.toLowerCase().includes(params.location!.toLowerCase())
      );
    }
    
    if (params.jobType) {
      filteredJobs = filteredJobs.filter(job => 
        job.jobType?.toLowerCase() === params.jobType!.toLowerCase()
      );
    }
    
    if (params.category) {
      filteredJobs = filteredJobs.filter(job => 
        job.category?.toLowerCase() === params.category!.toLowerCase()
      );
    }
    
    if (params.keywords && params.keywords.length > 0) {
      filteredJobs = filteredJobs.filter(job => {
        const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
        return params.keywords!.some(keyword => jobText.includes(keyword.toLowerCase()));
      });
    }
    
    return {
      success: true,
      jobs: filteredJobs.slice(0, 5), // Return top 5 matches
      totalFound: filteredJobs.length,
    };
  } catch (error) {
    console.error("Error searching jobs:", error);
    return {
      success: false,
      error: "Failed to search jobs",
    };
  }
}

async function analyzeResume(resumeText: string) {
  try {
    // Use Gemini for resume analysis
    const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `
    Analyze this teaching resume and provide:
    1. Key strengths (3-5 points)
    2. Areas for improvement (3-5 points)
    3. Specific suggestions for enhancement (3-5 points)
    4. Overall match score for teaching positions in Assam (0-100)
    
    Resume:
    ${resumeText}
    
    Format the response as JSON matching this structure:
    {
      "strengths": ["strength1", "strength2", ...],
      "weaknesses": ["weakness1", "weakness2", ...],
      "suggestions": ["suggestion1", "suggestion2", ...],
      "matchScore": 85
    }
    `;
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback response
    return {
      strengths: ["Unable to analyze resume"],
      weaknesses: ["Please try again"],
      suggestions: ["Ensure resume text is clear"],
      matchScore: 0,
    };
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return {
      strengths: ["Error analyzing resume"],
      weaknesses: ["Technical issue occurred"],
      suggestions: ["Please try again later"],
      matchScore: 0,
    };
  }
}

async function prepareInterview(jobTitle: string, schoolType?: string) {
  try {
    // Use OpenAI for interview preparation
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert interview coach for teaching positions in Assam, India.",
        },
        {
          role: "user",
          content: `Generate 5 interview questions with tips for a ${jobTitle} position${
            schoolType ? ` at a ${schoolType} school` : ""
          } in Assam. Include both general and role-specific questions.`,
        },
      ],
      response_format: { type: "json_object" },
    });
    
    const content = response.choices[0].message.content;
    if (content) {
      return JSON.parse(content);
    }
    
    // Fallback
    return {
      questions: [
        {
          question: "Why do you want to teach in Assam?",
          category: "General",
          tips: "Show knowledge of local education system and cultural sensitivity",
        },
      ],
      generalAdvice: "Research the school and practice your answers",
    };
  } catch (error) {
    console.error("Error preparing interview:", error);
    return {
      questions: [],
      generalAdvice: "Error generating interview questions",
    };
  }
}

// Main agent chat function
export async function processAgentChat(message: string, userId?: number) {
  try {
    // First, use OpenAI to determine if we need to use any tools
    const toolDecision = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for teachers in Assam. Analyze the user's message and determine if you need to use any tools.
          Available tools:
          - search_jobs: Search for teaching positions
          - analyze_resume: Analyze resume content
          - prepare_interview: Generate interview questions
          - track_application: Check application status
          
          Respond with the tool to use and parameters, or 'none' if no tool is needed.`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      tools: tools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: "object",
            properties: tool.parameters.shape,
            required: Object.keys(tool.parameters.shape),
          },
        },
      })),
      tool_choice: "auto",
    });
    
    let toolResults: any[] = [];
    
    // Execute any requested tools
    if (toolDecision.choices[0].message.tool_calls) {
      for (const toolCall of toolDecision.choices[0].message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        
        switch (toolCall.function.name) {
          case "search_jobs":
            const jobResults = await searchJobs(args);
            toolResults.push({
              tool: "search_jobs",
              result: jobResults,
            });
            break;
            
          case "analyze_resume":
            const resumeAnalysis = await analyzeResume(args.resumeText);
            toolResults.push({
              tool: "analyze_resume",
              result: resumeAnalysis,
            });
            break;
            
          case "prepare_interview":
            const interviewPrep = await prepareInterview(args.jobTitle, args.schoolType);
            toolResults.push({
              tool: "prepare_interview",
              result: interviewPrep,
            });
            break;
            
          case "track_application":
            // Implement application tracking
            toolResults.push({
              tool: "track_application",
              result: { status: "Not implemented yet" },
            });
            break;
        }
      }
    }
    
    // Generate final response using both tool results and general knowledge
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping teachers in Assam find jobs and advance their careers.
          Use the tool results to provide a helpful, personalized response.
          Be encouraging, practical, and culturally aware.`,
        },
        {
          role: "user",
          content: `User query: ${message}
          
          Tool results: ${JSON.stringify(toolResults, null, 2)}
          
          Provide a helpful response that incorporates the tool results naturally.`,
        },
      ],
    });
    
    return {
      success: true,
      message: finalResponse.choices[0].message.content || "I'm here to help!",
      toolsUsed: toolResults.map(r => r.tool),
    };
  } catch (error) {
    console.error("Agent chat error:", error);
    
    // Fallback to Gemini if OpenAI fails
    try {
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(`
        As an AI assistant for teachers in Assam, respond to: ${message}
        Be helpful, encouraging, and provide practical advice.
      `);
      
      return {
        success: true,
        message: result.response.text(),
        toolsUsed: [],
      };
    } catch (geminiError) {
      console.error("Gemini fallback error:", geminiError);
      return {
        success: false,
        message: "I'm having trouble processing your request. Please try again.",
        toolsUsed: [],
      };
    }
  }
}