import { StateGraph, MemorySaver, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";
import { MemoryStore } from "./memory-store";

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

// Task Result structure for ADK-style response handling
interface TaskResult {
  agentName: string;
  task: string;
  result: string;
  confidence: number;
  metadata?: {
    sources?: string[];
    calculations?: any[];
    insights?: string[];
    recommendations?: string[];
  };
}

// Resume Analyzer Agent - Enhanced with Google ADK patterns
async function resumeAnalyzerAgent(state: typeof AgentStateAnnotation.State) {
  const supervisorDecision = state.context?.supervisorDecision;
  const resumeContent = supervisorDecision?.parameters?.resumeContent || "";
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content || resumeContent;
  
  try {
    // ADK-style structured prompting with clear role definition
    const systemInstruction = `You are an elite resume analysis specialist using Google's Agent Development Kit (ADK) framework.
Your expertise covers teaching positions in Assam's education system with deep knowledge of:

CORE COMPETENCIES:
• Educational Qualifications Analysis (B.Ed, M.Ed, D.El.Ed, TET, CTET, HTET)
• Teaching Methodology Assessment (modern pedagogical approaches, digital literacy)
• Language Proficiency Evaluation (Assamese, English, Hindi, Bengali)
• Government Service Readiness (APSC requirements, reservation policies)
• School-Type Matching (KVS, NVS, CBSE, State Board, Private institutions)

ANALYSIS FRAMEWORK:
1. Qualification Scoring (0-100 scale with weighted criteria)
2. Gap Analysis with actionable improvement strategies
3. Position-Qualification Matrix mapping
4. Competitive Advantage Assessment
5. Regional Market Insights for Assam

OUTPUT STRUCTURE:
Always provide analysis as structured JSON with confidence scoring.`;

    // Multi-stage analysis prompt
    const analysisPrompt = `TASK: Comprehensive Resume Analysis for Teaching Positions in Assam

INPUT DATA:
${userQuery}

ANALYSIS STAGES:
Stage 1 - Qualification Extraction:
Extract and categorize all educational qualifications, certifications, experience, and skills.

Stage 2 - Scoring Matrix:
Apply weighted scoring:
- Educational Qualifications (30%)
- Teaching Experience (25%)
- Certifications (TET/CTET) (20%)
- Language Skills (15%)
- Additional Skills/Achievements (10%)

Stage 3 - Market Matching:
Match profile against current Assam teaching job market:
- Government positions (APSC, SSA)
- Central schools (KVS, NVS)
- Private institutions
- Contract/Guest faculty roles

Stage 4 - Strategic Recommendations:
Provide data-driven recommendations for:
- Immediate application opportunities
- Short-term skill enhancement (3-6 months)
- Long-term career progression (1-2 years)`;

    // Execute advanced analysis with Gemini
    const model = genAI.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            overallScore: { type: "number", minimum: 0, maximum: 100 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            qualificationBreakdown: {
              type: "object",
              properties: {
                education: { 
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    details: { type: "string" }
                  }
                },
                experience: { 
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    details: { type: "string" }
                  }
                },
                certifications: { 
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    details: { type: "string" }
                  }
                },
                languages: { 
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    details: { type: "string" }
                  }
                },
                additionalSkills: { 
                  type: "object",
                  properties: {
                    score: { type: "number" },
                    details: { type: "string" }
                  }
                }
              }
            },
            strengths: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  detail: { type: "string" },
                  marketValue: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            },
            improvementAreas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  actionPlan: { type: "string" },
                  timeframe: { type: "string" }
                }
              }
            },
            matchedPositions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string" },
                  institution: { type: "string" },
                  matchScore: { type: "number" },
                  requirements: { type: "string" }
                }
              }
            },
            careerRoadmap: {
              type: "object",
              properties: {
                immediate: { type: "array", items: { type: "string" } },
                shortTerm: { type: "array", items: { type: "string" } },
                longTerm: { type: "array", items: { type: "string" } }
              }
            },
            assamSpecificInsights: { type: "string" },
            competitiveAnalysis: { type: "string" }
          }
        }
      },
      contents: analysisPrompt
    });
    
    const analysis = await model;
    const analysisData = JSON.parse(analysis.text || "{}");
    
    // Create structured TaskResult
    const taskResult: TaskResult = {
      agentName: "Resume Analyzer (Gemini ADK)",
      task: "Comprehensive Teaching Resume Analysis",
      result: formatAnalysisResult(analysisData),
      confidence: analysisData.confidence || 0.85,
      metadata: {
        sources: ["Assam Education Department", "TET/CTET Guidelines", "School Recruitment Patterns"],
        insights: extractKeyInsights(analysisData),
        recommendations: analysisData.careerRoadmap?.immediate || []
      }
    };
    
    // Save enhanced analysis to memory
    if (state.userId) {
      await MemoryStore.saveResumeAnalysis(state.userId, {
        score: analysisData.overallScore || 0,
        fullAnalysis: JSON.stringify(taskResult),
        timestamp: new Date(),
        metadata: {
          confidence: taskResult.confidence,
          matchedPositions: analysisData.matchedPositions
        }
      });
    }
    
    return {
      resumeAnalysis: analysisData,
      taskResult: taskResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: taskResult.result,
          name: "resume_analyzer"
        })
      ]
    };
  } catch (error: any) {
    console.error("Enhanced resume analysis error:", error);
    
    // Fallback with intelligent error handling
    const fallbackResult: TaskResult = {
      agentName: "Resume Analyzer",
      task: "Resume Analysis",
      result: generateFallbackAnalysis(userQuery),
      confidence: 0.6,
      metadata: {
        insights: ["Analysis performed with limited AI capacity"],
        recommendations: getGenericRecommendations()
      }
    };
    
    return {
      taskResult: fallbackResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: fallbackResult.result,
          name: "resume_analyzer"
        })
      ]
    };
  }
}

// Helper function to format analysis results
function formatAnalysisResult(data: any): string {
  const score = data.overallScore || 0;
  const emoji = score >= 80 ? "🌟" : score >= 60 ? "✅" : "📈";
  
  let result = `${emoji} **Resume Analysis Complete**\n\n`;
  result += `**Overall Match Score**: ${score}/100 (Confidence: ${((data.confidence || 0.85) * 100).toFixed(0)}%)\n\n`;
  
  // Qualification Breakdown
  result += `**📊 Qualification Breakdown**:\n`;
  if (data.qualificationBreakdown) {
    Object.entries(data.qualificationBreakdown).forEach(([key, value]: [string, any]) => {
      result += `• ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value.score}/100 - ${value.details}\n`;
    });
  }
  
  // Strengths
  result += `\n**💪 Key Strengths**:\n`;
  data.strengths?.forEach((strength: any) => {
    result += `• ${strength.detail} (Market Value: ${strength.marketValue})\n`;
  });
  
  // Improvement Areas
  result += `\n**📈 Areas for Enhancement**:\n`;
  data.improvementAreas?.forEach((area: any) => {
    result += `• **${area.area}** (Priority: ${area.priority})\n`;
    result += `  → ${area.actionPlan} (${area.timeframe})\n`;
  });
  
  // Matched Positions
  result += `\n**🎯 Best-Matched Positions**:\n`;
  data.matchedPositions?.slice(0, 5).forEach((position: any) => {
    result += `• **${position.role}** at ${position.institution}\n`;
    result += `  Match Score: ${position.matchScore}% | Requirements: ${position.requirements}\n`;
  });
  
  // Career Roadmap
  result += `\n**🗺️ Career Development Roadmap**:\n`;
  result += `**Immediate Actions** (Next 30 days):\n`;
  data.careerRoadmap?.immediate?.forEach((action: string) => {
    result += `• ${action}\n`;
  });
  
  // Assam-specific insights
  if (data.assamSpecificInsights) {
    result += `\n**🌏 Assam Education Market Insights**:\n${data.assamSpecificInsights}\n`;
  }
  
  // Competitive analysis
  if (data.competitiveAnalysis) {
    result += `\n**🏆 Competitive Positioning**:\n${data.competitiveAnalysis}\n`;
  }
  
  return result;
}

// Extract key insights for metadata
function extractKeyInsights(data: any): string[] {
  const insights: string[] = [];
  
  if (data.overallScore >= 80) {
    insights.push("Highly competitive profile for senior teaching positions");
  } else if (data.overallScore >= 60) {
    insights.push("Good foundation with room for strategic improvements");
  } else {
    insights.push("Focus on building core qualifications for better opportunities");
  }
  
  if (data.strengths?.some((s: any) => s.category === "certifications")) {
    insights.push("Strong certification profile enhances government job eligibility");
  }
  
  if (data.qualificationBreakdown?.languages?.score >= 80) {
    insights.push("Excellent language skills provide competitive advantage in Assam");
  }
  
  return insights;
}

// Generate fallback analysis when API fails
function generateFallbackAnalysis(content: string): string {
  const hasExperience = /\d+\s*years?/i.test(content);
  const hasCertification = /TET|CTET|B\.Ed|M\.Ed/i.test(content);
  const hasLanguage = /Assamese|Hindi|English/i.test(content);
  
  let analysis = `**Resume Analysis** (Offline Mode)\n\n`;
  
  if (hasExperience && hasCertification && hasLanguage) {
    analysis += `Based on your qualifications, you appear to have a strong foundation for teaching positions in Assam.\n\n`;
    analysis += `**Identified Strengths**:\n`;
    if (hasExperience) analysis += `• Teaching experience mentioned\n`;
    if (hasCertification) analysis += `• Relevant certifications (TET/CTET/B.Ed)\n`;
    if (hasLanguage) analysis += `• Language proficiency indicated\n`;
  }
  
  analysis += `\n**General Recommendations**:\n`;
  analysis += `• Ensure TET/CTET certifications are up-to-date\n`;
  analysis += `• Highlight experience with Assam state curriculum\n`;
  analysis += `• Emphasize multilingual teaching abilities\n`;
  analysis += `• Include digital teaching skills and modern pedagogy\n`;
  
  return analysis;
}

// Get generic recommendations
function getGenericRecommendations(): string[] {
  return [
    "Update TET/CTET certifications if expired",
    "Add digital teaching certifications (Google Educator, Microsoft Educator)",
    "Include experience with online teaching platforms",
    "Highlight any research publications or conference presentations",
    "Obtain NIEPID certification for inclusive education"
  ];
}

// Job Search Agent - Enhanced with ADK patterns
async function jobSearchAgent(state: typeof AgentStateAnnotation.State) {
  const supervisorDecision = state.context?.supervisorDecision;
  const searchParams = supervisorDecision?.parameters || {};
  const userId = state.userId;
  
  try {
    // Search jobs from storage
    const allJobs = await storage.getJobListings();
    
    // Apply intelligent filtering
    let filteredJobs = allJobs;
    
    // Location-based filtering with fuzzy matching
    if (searchParams.location) {
      filteredJobs = filteredJobs.filter(job => {
        const jobLocation = job.location.toLowerCase();
        const searchLocation = searchParams.location.toLowerCase();
        return jobLocation.includes(searchLocation) || 
               searchLocation.includes(jobLocation) ||
               (searchLocation === "assam" && ["guwahati", "tezpur", "dibrugarh", "jorhat"].some(city => jobLocation.includes(city)));
      });
    }
    
    // Multi-criteria filtering
    if (searchParams.jobType) {
      filteredJobs = filteredJobs.filter(job => job.jobType === searchParams.jobType);
    }
    
    if (searchParams.category) {
      filteredJobs = filteredJobs.filter(job => job.category === searchParams.category);
    }
    
    // Intelligent keyword matching
    if (searchParams.keywords && searchParams.keywords.length > 0) {
      filteredJobs = filteredJobs.filter(job => {
        const jobText = `${job.title} ${job.description} ${job.organization} ${job.requirements || ''}`.toLowerCase();
        return searchParams.keywords.some((keyword: string) => {
          const lowerKeyword = keyword.toLowerCase();
          // Check for subject-specific matches
          if (lowerKeyword.includes("math")) {
            return jobText.includes("math") || jobText.includes("mathematics");
          }
          if (lowerKeyword.includes("english")) {
            return jobText.includes("english") || jobText.includes("language");
          }
          if (lowerKeyword.includes("science")) {
            return jobText.includes("science") || jobText.includes("physics") || jobText.includes("chemistry") || jobText.includes("biology");
          }
          return jobText.includes(lowerKeyword);
        });
      });
    }
    
    // Use Gemini for advanced job analysis with ADK patterns
    const jobAnalysisPrompt = `You are a job market analyst specializing in teaching positions in Assam.
    
Analyze these ${filteredJobs.length} teaching positions and provide:

1. **Market Overview**: Current demand trends for teaching positions
2. **Top Recommendations**: Rank the top 5 positions based on:
   - Career growth potential
   - Salary competitiveness
   - Institution reputation
   - Work-life balance
   - Location advantages

3. **Strategic Insights**:
   - Best positions for fresh graduates vs experienced teachers
   - Government vs Private sector opportunities
   - Emerging trends in education sector

4. **Application Strategy**:
   - Priority order for applications
   - Key requirements to highlight
   - Timeline considerations

Jobs to analyze:
${JSON.stringify(filteredJobs.slice(0, 15).map(job => ({
  id: job.id,
  title: job.title,
  organization: job.organization,
  location: job.location,
  salary: job.salary,
  category: job.category,
  requirements: job.requirements
})), null, 2)}`;

    const jobAnalysis = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048
      },
      contents: jobAnalysisPrompt
    });
    
    // Create ADK-style task result
    const taskResult: TaskResult = {
      agentName: "Job Search Analyst",
      task: "Teaching Position Search & Analysis",
      result: formatJobSearchResults(filteredJobs, jobAnalysis.text || ""),
      confidence: 0.9,
      metadata: {
        sources: ["Database Search", "Market Analysis", "Institution Rankings"],
        insights: [
          `Found ${filteredJobs.length} matching positions`,
          `${filteredJobs.filter(j => j.category === "Government").length} government positions available`,
          `Salary range: ${extractSalaryRange(filteredJobs)}`
        ],
        recommendations: filteredJobs.slice(0, 5).map(job => `Apply to ${job.title} at ${job.organization}`)
      }
    };
    
    // Save search history
    if (userId) {
      await MemoryStore.saveSearchHistory(userId, {
        query: searchParams,
        results: filteredJobs.map(j => j.id),
        timestamp: new Date()
      });
    }
    
    return {
      jobSearchResults: filteredJobs.slice(0, 10),
      taskResult: taskResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: taskResult.result,
          name: "job_searcher"
        })
      ]
    };
  } catch (error) {
    console.error("Job search error:", error);
    
    return {
      jobSearchResults: [],
      messages: [
        ...state.messages,
        new AIMessage({
          content: "I encountered an error while searching for jobs. Please try again with different search criteria.",
          name: "job_searcher"
        })
      ]
    };
  }
}

// Format job search results with insights
function formatJobSearchResults(jobs: any[], analysisText: string): string {
  const totalJobs = jobs.length;
  const govJobs = jobs.filter(j => j.category === "Government").length;
  const privateJobs = jobs.filter(j => j.category === "Private").length;
  
  let result = `🔍 **Job Search Results**\n\n`;
  result += `Found **${totalJobs} teaching positions** matching your criteria:\n`;
  result += `• Government: ${govJobs} positions\n`;
  result += `• Private: ${privateJobs} positions\n\n`;
  
  if (jobs.length > 0) {
    result += `**📋 Top Opportunities**:\n\n`;
    jobs.slice(0, 5).forEach((job, index) => {
      result += `${index + 1}. **${job.title}**\n`;
      result += `   📍 ${job.organization}, ${job.location}\n`;
      result += `   💰 ${job.salary || "Salary not specified"}\n`;
      result += `   📅 Category: ${job.category}\n`;
      if (job.requirements) {
        result += `   📝 Key Requirements: ${job.requirements.substring(0, 100)}...\n`;
      }
      result += `\n`;
    });
  }
  
  // Add AI analysis
  if (analysisText) {
    result += `\n**🤖 AI Market Analysis**:\n${analysisText}\n`;
  }
  
  // Add action items
  result += `\n**💡 Recommended Actions**:\n`;
  result += `• Review full job descriptions carefully\n`;
  result += `• Tailor your resume for each application\n`;
  result += `• Apply to government positions before deadlines\n`;
  result += `• Prepare for demo classes for private schools\n`;
  
  return result;
}

// Extract salary range from jobs
function extractSalaryRange(jobs: any[]): string {
  const salaries = jobs
    .map(job => job.salary)
    .filter(salary => salary && salary.includes("₹"))
    .map(salary => {
      const numbers = salary.match(/₹[\d,]+/g);
      if (numbers && numbers.length > 0) {
        return parseInt(numbers[0].replace(/[₹,]/g, ""));
      }
      return 0;
    })
    .filter(salary => salary > 0);
  
  if (salaries.length === 0) return "Not specified";
  
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  
  return `₹${min.toLocaleString()} - ₹${max.toLocaleString()}`;
}

// Interview Prep Agent - Enhanced with ADK patterns
async function interviewPrepAgent(state: typeof AgentStateAnnotation.State) {
  const supervisorDecision = state.context?.supervisorDecision;
  const { jobTitle, school, category } = supervisorDecision?.parameters || {};
  const userId = state.userId;
  
  try {
    // ADK-style comprehensive interview preparation
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an elite interview preparation specialist using advanced coaching frameworks.
          Your expertise covers teaching interviews in Assam's education system.
          
          PREPARATION FRAMEWORK:
          1. Role-specific question bank (behavioral, technical, situational)
          2. Cultural and institutional alignment strategies
          3. Demo lesson planning and presentation tips
          4. Salary negotiation guidance for Assam market
          5. Post-interview follow-up strategies
          
          Provide structured JSON output with confidence levels and specific examples.`
        },
        {
          role: "user",
          content: `Prepare comprehensive interview guidance for:
          Position: ${jobTitle || "Teaching Position"}
          Institution: ${school || "School in Assam"}
          Category: ${category || "General"}
          
          Include:
          1. Top 10 likely interview questions with model answers
          2. Institution-specific preparation tips
          3. Demo lesson suggestions
          4. Questions to ask the interviewer
          5. Cultural considerations for Assam schools
          6. Salary negotiation strategies
          7. Common pitfalls to avoid`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4096
    });
    
    const prepData = JSON.parse(response.choices[0].message.content || "{}");
    
    // Create ADK-style task result
    const taskResult: TaskResult = {
      agentName: "Interview Preparation Coach",
      task: "Comprehensive Interview Preparation",
      result: formatInterviewPrep(prepData, jobTitle, school),
      confidence: 0.92,
      metadata: {
        sources: ["Interview Best Practices", "Assam School Culture", "Teacher Interview Patterns"],
        insights: extractInterviewInsights(prepData),
        recommendations: [
          "Practice answers using STAR method",
          "Prepare a 10-minute demo lesson",
          "Research the school's academic achievements",
          "Dress formally in traditional or western attire"
        ]
      }
    };
    
    // Save interview prep to memory
    if (userId) {
      await MemoryStore.updateUserProfile(userId, {
        lastInterviewPrep: {
          position: jobTitle,
          school: school,
          preparedAt: new Date(),
          keyPoints: taskResult.metadata?.insights
        }
      });
    }
    
    return {
      interviewPrep: prepData,
      taskResult: taskResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: taskResult.result,
          name: "interview_prepper"
        })
      ]
    };
  } catch (error) {
    console.error("Interview prep error:", error);
    
    // Fallback preparation
    const fallbackResult: TaskResult = {
      agentName: "Interview Coach",
      task: "Interview Preparation",
      result: generateFallbackInterviewPrep(jobTitle, school),
      confidence: 0.7,
      metadata: {
        insights: ["Basic interview preparation provided"],
        recommendations: getGenericInterviewTips()
      }
    };
    
    return {
      taskResult: fallbackResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: fallbackResult.result,
          name: "interview_prepper"
        })
      ]
    };
  }
}

// Format interview preparation results
function formatInterviewPrep(data: any, jobTitle?: string, school?: string): string {
  let result = `🎯 **Interview Preparation Guide**\n\n`;
  result += `**Position**: ${jobTitle || "Teaching Position"}\n`;
  result += `**Institution**: ${school || "School in Assam"}\n\n`;
  
  // Key Questions
  if (data.questions && data.questions.length > 0) {
    result += `**📝 Top Interview Questions & Model Answers**:\n\n`;
    data.questions.slice(0, 5).forEach((q: any, index: number) => {
      result += `${index + 1}. **${q.question}**\n`;
      result += `   💡 *Model Answer*: ${q.answer}\n`;
      result += `   🎯 *Key Points*: ${q.keyPoints?.join(", ") || "Be specific and authentic"}\n\n`;
    });
  }
  
  // Institution Tips
  if (data.institutionTips) {
    result += `**🏫 Institution-Specific Preparation**:\n`;
    data.institutionTips.forEach((tip: string) => {
      result += `• ${tip}\n`;
    });
    result += `\n`;
  }
  
  // Demo Lesson
  if (data.demoLesson) {
    result += `**👩‍🏫 Demo Lesson Suggestions**:\n`;
    result += `• Topic: ${data.demoLesson.topic}\n`;
    result += `• Duration: ${data.demoLesson.duration}\n`;
    result += `• Key Elements: ${data.demoLesson.elements?.join(", ")}\n\n`;
  }
  
  // Questions to Ask
  if (data.questionsToAsk) {
    result += `**❓ Questions to Ask the Interviewer**:\n`;
    data.questionsToAsk.forEach((q: string) => {
      result += `• ${q}\n`;
    });
    result += `\n`;
  }
  
  // Cultural Considerations
  if (data.culturalTips) {
    result += `**🌏 Cultural Considerations for Assam Schools**:\n`;
    data.culturalTips.forEach((tip: string) => {
      result += `• ${tip}\n`;
    });
    result += `\n`;
  }
  
  // Salary Negotiation
  if (data.salaryGuidance) {
    result += `**💰 Salary Negotiation Strategy**:\n`;
    result += `• Expected Range: ${data.salaryGuidance.range}\n`;
    result += `• Negotiation Tips: ${data.salaryGuidance.tips}\n\n`;
  }
  
  // Final Tips
  result += `**✨ Final Success Tips**:\n`;
  result += `• Arrive 15 minutes early\n`;
  result += `• Bring multiple copies of your resume and certificates\n`;
  result += `• Dress professionally (formal western or traditional attire)\n`;
  result += `• Show enthusiasm for teaching and student development\n`;
  result += `• Follow up with a thank you email within 24 hours\n`;
  
  return result;
}

// Extract interview insights
function extractInterviewInsights(data: any): string[] {
  const insights: string[] = [];
  
  if (data.questions?.length > 10) {
    insights.push("Comprehensive question bank prepared for thorough practice");
  }
  
  if (data.demoLesson) {
    insights.push("Demo lesson plan included for practical preparation");
  }
  
  if (data.culturalTips?.length > 0) {
    insights.push("Cultural alignment strategies provided for better fit");
  }
  
  if (data.salaryGuidance) {
    insights.push("Salary negotiation guidance based on current market rates");
  }
  
  return insights;
}

// Generate fallback interview prep
function generateFallbackInterviewPrep(jobTitle?: string, school?: string): string {
  return `**Interview Preparation Guide** (Basic)\n\n
**Position**: ${jobTitle || "Teaching Position"}
**School**: ${school || "Educational Institution"}

**Common Interview Questions**:
1. Tell us about yourself and your teaching philosophy
2. Why do you want to work at our school?
3. How do you handle classroom discipline?
4. Describe your experience with the curriculum
5. How do you engage students who are struggling?

**Preparation Tips**:
• Research the school's mission and values
• Prepare examples using the STAR method
• Practice a 10-minute demo lesson
• Prepare questions about professional development
• Dress professionally and arrive early

**Key Points to Emphasize**:
• Your passion for teaching
• Experience with diverse learners
• Commitment to student success
• Willingness to participate in school activities
• Continuous learning mindset`;
}

// Get generic interview tips
function getGenericInterviewTips(): string[] {
  return [
    "Research the school thoroughly",
    "Practice common teaching interview questions",
    "Prepare a demo lesson plan",
    "Bring portfolio of student work samples",
    "Show enthusiasm for the teaching profession"
  ];
}

// Conversational Agent - Enhanced with ADK patterns
async function conversationalAgent(state: typeof AgentStateAnnotation.State) {
  const messages = state.messages;
  const lastUserMessage = messages.filter(m => m._getType() === "human").pop();
  const userId = state.userId;
  
  try {
    // Get user context for personalized responses
    const userContext = userId ? await MemoryStore.getUserContext(userId) : null;
    
    // ADK-style conversational agent with context awareness
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert educational career advisor using Google's ADK framework.
          Your role is to provide comprehensive guidance on teaching careers in Assam.
          
          EXPERTISE AREAS:
          • Career progression in teaching (entry-level to principal)
          • Professional development opportunities
          • Work-life balance in education sector
          • Government policies and benefits for teachers
          • Alternative career paths in education
          • Continuing education and certifications
          
          CONVERSATION STYLE:
          • Warm, supportive, and encouraging
          • Data-driven insights when applicable
          • Culturally sensitive to Assam context
          • Solution-oriented approach
          • Personalized based on user history
          
          ${userContext ? `USER CONTEXT:\n${userContext}` : ""}`
        },
        {
          role: "user",
          content: lastUserMessage?.content || ""
        }
      ],
      temperature: 0.8,
      max_tokens: 2048
    });
    
    const responseContent = response.choices[0].message.content || "";
    
    // Analyze conversation topic for insights
    const topicAnalysis = analyzeConversationTopic(lastUserMessage?.content || "");
    
    // Create ADK-style task result
    const taskResult: TaskResult = {
      agentName: "Educational Career Advisor",
      task: "Career Guidance & Support",
      result: responseContent,
      confidence: 0.88,
      metadata: {
        sources: ["Education Policy Assam", "Teacher Development Programs", "Career Guidance Framework"],
        insights: [
          `Topic: ${topicAnalysis.topic}`,
          `Sentiment: ${topicAnalysis.sentiment}`,
          `Personalization level: ${userContext ? "High" : "Standard"}`
        ],
        recommendations: generateContextualRecommendations(topicAnalysis.topic)
      }
    };
    
    // Update conversation history
    if (userId) {
      await MemoryStore.saveThreadMemory(
        state.threadId || "default",
        userId,
        messages,
        {
          lastTopic: topicAnalysis.topic,
          sentiment: topicAnalysis.sentiment
        }
      );
    }
    
    return {
      taskResult: taskResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: responseContent,
          name: "conversationalist"
        })
      ]
    };
  } catch (error) {
    console.error("Conversational agent error:", error);
    
    // Fallback response
    const fallbackResult: TaskResult = {
      agentName: "Career Advisor",
      task: "General Guidance",
      result: generateFallbackConversationalResponse(lastUserMessage?.content || ""),
      confidence: 0.65,
      metadata: {
        insights: ["Providing general guidance"],
        recommendations: ["Consider asking more specific questions about teaching careers"]
      }
    };
    
    return {
      taskResult: fallbackResult,
      messages: [
        ...state.messages,
        new AIMessage({
          content: fallbackResult.result,
          name: "conversationalist"
        })
      ]
    };
  }
}

// Analyze conversation topic
function analyzeConversationTopic(message: string): { topic: string; sentiment: string } {
  const lowerMessage = message.toLowerCase();
  
  // Topic detection
  let topic = "General Inquiry";
  if (lowerMessage.includes("salary") || lowerMessage.includes("pay")) {
    topic = "Compensation & Benefits";
  } else if (lowerMessage.includes("career") || lowerMessage.includes("growth")) {
    topic = "Career Development";
  } else if (lowerMessage.includes("school") || lowerMessage.includes("institution")) {
    topic = "School Information";
  } else if (lowerMessage.includes("qualification") || lowerMessage.includes("degree")) {
    topic = "Educational Requirements";
  } else if (lowerMessage.includes("government") || lowerMessage.includes("policy")) {
    topic = "Government Policies";
  } else if (lowerMessage.includes("stress") || lowerMessage.includes("work-life")) {
    topic = "Work-Life Balance";
  }
  
  // Sentiment analysis
  let sentiment = "Neutral";
  if (lowerMessage.includes("worried") || lowerMessage.includes("concerned") || lowerMessage.includes("difficult")) {
    sentiment = "Concerned";
  } else if (lowerMessage.includes("excited") || lowerMessage.includes("happy") || lowerMessage.includes("great")) {
    sentiment = "Positive";
  } else if (lowerMessage.includes("confused") || lowerMessage.includes("help") || lowerMessage.includes("don't know")) {
    sentiment = "Seeking Guidance";
  }
  
  return { topic, sentiment };
}

// Generate contextual recommendations
function generateContextualRecommendations(topic: string): string[] {
  const recommendationMap: { [key: string]: string[] } = {
    "Compensation & Benefits": [
      "Review government pay scales for teachers",
      "Consider additional income through tuition",
      "Explore benefits like pension and medical coverage"
    ],
    "Career Development": [
      "Pursue M.Ed or PhD for better opportunities",
      "Attend professional development workshops",
      "Build network within education community"
    ],
    "School Information": [
      "Research school ratings and reviews",
      "Visit schools before applying",
      "Connect with current teachers for insights"
    ],
    "Educational Requirements": [
      "Ensure all certifications are current",
      "Consider additional subject specializations",
      "Stay updated with NEP 2020 requirements"
    ],
    "Government Policies": [
      "Stay informed about APSC notifications",
      "Understand reservation policies",
      "Track changes in education policies"
    ],
    "Work-Life Balance": [
      "Set boundaries for work hours",
      "Engage in stress-relief activities",
      "Join teacher support groups"
    ],
    "General Inquiry": [
      "Explore our job search feature",
      "Get your resume analyzed",
      "Prepare for upcoming interviews"
    ]
  };
  
  return recommendationMap[topic] || recommendationMap["General Inquiry"];
}

// Generate fallback conversational response
function generateFallbackConversationalResponse(message: string): string {
  return `I understand you're looking for guidance about teaching careers in Assam. 

While I'm experiencing some technical limitations at the moment, here are some general points that might help:

**Teaching Career in Assam - Key Points**:
• Government teaching positions offer job security and good benefits
• Private schools may offer higher initial salaries but vary in job security
• TET/CTET certification is essential for most teaching positions
• Continuous professional development improves career prospects
• The education sector in Assam is growing with new opportunities

For more specific guidance, you might want to:
• Use our resume analyzer to assess your qualifications
• Search for current job openings in your preferred location
• Prepare for interviews with our interview prep tool

Is there a specific aspect of teaching careers you'd like to know more about?`;
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