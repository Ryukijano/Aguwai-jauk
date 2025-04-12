import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { storage } from "./storage";

// Simple job search function
async function searchJobs(query: string): Promise<string> {
  try {
    // Extract possible filters from the query
    const locationMatch = query.match(/in\s+([A-Za-z\s]+)/i);
    const subjectMatch = query.match(/(math|science|english|history|computer|physics|chemistry|biology|language)/i);
    
    const filters: any = {};
    if (locationMatch && locationMatch[1]) {
      filters.location = locationMatch[1].trim();
    }
    
    if (subjectMatch && subjectMatch[1]) {
      if (subjectMatch[1].toLowerCase() === 'math') {
        filters.tags = ["Mathematics"];
      } else if (subjectMatch[1].toLowerCase() === 'english') {
        filters.tags = ["English"];
      }
      // Add more subject mappings as needed
    }
    
    // Check if query mentions government or private schools
    if (query.toLowerCase().includes('government')) {
      filters.category = "Government";
    } else if (query.toLowerCase().includes('private')) {
      filters.category = "Private";
    }
    
    const jobs = await storage.getJobListings(filters);
    
    if (jobs.length === 0) {
      return "I couldn't find any teaching jobs matching your criteria. Would you like to search with different parameters?";
    }
    
    // Format job results
    let response = `I found ${jobs.length} teaching job(s) that might interest you:\n\n`;
    
    jobs.forEach((job, index) => {
      response += `Position: ${job.title}\n`;
      response += `Organization: ${job.organization}\n`;
      response += `Location: ${job.location}\n`;
      response += `Salary: ${job.salary}\n`;
      response += `Requirements: ${job.requirements}\n`;
      const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : new Date();
      response += `Application Deadline: ${deadline.toLocaleDateString()}\n`;
      
      if (index < jobs.length - 1) {
        response += `\n---\n\n`;
      }
    });
    
    return response;
  } catch (error) {
    console.error("Error searching jobs:", error);
    return "I encountered an issue while searching for jobs. Please try again.";
  }
}

// Function to analyze resume or cover letter
async function analyzeDocument(documentType: string, content: string): Promise<string> {
  try {
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
      { role: "system", content: systemPrompt },
      { role: "user", content }
    ]);
    
    return result.content.toString();
  } catch (error) {
    console.error(`Error analyzing ${documentType}:`, error);
    return `There was an error analyzing your ${documentType}. Please try again.`;
  }
}

// Generate interview questions
async function generateInterviewQuestions(query: string): Promise<string> {
  try {
    // Extract position from query
    const positionMatch = query.match(/(elementary|primary|secondary|high school|math|science|english|history)/i);
    const position = positionMatch ? positionMatch[0] : "teaching";
    
    // Determine school type
    let schoolType = "";
    if (query.toLowerCase().includes('government')) {
      schoolType = "government";
    } else if (query.toLowerCase().includes('private')) {
      schoolType = "private";
    }
    
    // Determine experience level
    let experienceLevel = "";
    if (query.toLowerCase().includes('entry') || query.toLowerCase().includes('beginner')) {
      experienceLevel = "entry-level";
    } else if (query.toLowerCase().includes('experienced') || query.toLowerCase().includes('senior')) {
      experienceLevel = "experienced";
    }
    
    const model = new ChatOpenAI({ 
      modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      temperature: 0.7
    });
    
    const prompt = `Generate 5-7 realistic interview questions for a ${position} position 
    ${schoolType ? `at a ${schoolType} school in Assam` : "in Assam"} 
    ${experienceLevel ? `for ${experienceLevel} candidates` : ""}. 
    Include questions about:
    1. Teaching methodology
    2. Classroom management
    3. Subject expertise
    4. Understanding of the local Assam education context
    5. Cultural awareness and language considerations`;
    
    const result = await model.invoke([
      { role: "system", content: "You are an expert on teacher interviews in Assam, India." },
      { role: "user", content: prompt }
    ]);
    
    return result.content.toString();
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return "I encountered an issue while generating interview questions. Please try again.";
  }
}

// Main assistant class
export class SimpleAssistant {
  private model: ChatOpenAI;
  
  constructor() {
    this.model = new ChatOpenAI({ 
      modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      temperature: 0.2
    });
  }
  
  // Process messages and determine if specialized tools need to be used
  async processMessage(userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
    try {
      // First, determine what the user is asking for
      if (this.isJobSearch(userMessage)) {
        return await searchJobs(userMessage);
      }
      
      if (this.isInterviewQuestions(userMessage)) {
        return await generateInterviewQuestions(userMessage);
      }
      
      if (this.isDocumentAnalysis(userMessage)) {
        const documentType = this.getDocumentType(userMessage);
        // In a real application, we'd get actual document content
        // This is just a placeholder for the logic flow
        const documentContent = "Sample document content for analysis";
        return await analyzeDocument(documentType, documentContent);
      }
      
      // For general inquiries, use the standard ChatOpenAI model
      const systemPrompt = `You are an AI Assistant for Aguwai Jauk - a specialized job portal for teachers in Assam, India.

Your primary role is to provide personalized guidance to teachers looking for jobs in Assam. You offer:

1. Job search assistance: Help users find relevant teaching positions based on their qualifications and preferences.
2. Application advice: Provide guidance on preparing resumes and writing effective cover letters.
3. Interview preparation: Offer tips on common interview questions for teaching positions.
4. Career development: Suggest professional development opportunities for teachers.
5. Regional insights: Share information about educational institutions in different regions of Assam.

Always be respectful, culturally sensitive, and focus on providing accurate, practical information.`;
      
      // Create a new chat history with the system message at the beginning
      const chatHistory = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage }
      ];
      
      const response = await this.model.invoke(chatHistory);
      return response.content.toString();
    } catch (error) {
      console.error("Error processing message:", error);
      return "I encountered an error while processing your request. Please try again.";
    }
  }
  
  // Helper methods to detect intent
  private isJobSearch(message: string): boolean {
    const jobSearchPatterns = [
      /find.*job/i,
      /search.*job/i,
      /looking for.*job/i,
      /job.*available/i,
      /teaching position/i,
      /job.*in (.*?)/i,
      /teaching opportunities/i
    ];
    
    return jobSearchPatterns.some(pattern => pattern.test(message));
  }
  
  private isInterviewQuestions(message: string): boolean {
    const interviewPatterns = [
      /interview question/i,
      /prepare.*interview/i,
      /interview.*preparation/i,
      /what.*ask.*interview/i,
      /interview.*tips/i
    ];
    
    return interviewPatterns.some(pattern => pattern.test(message));
  }
  
  private isDocumentAnalysis(message: string): boolean {
    const documentPatterns = [
      /review.*resume/i,
      /check.*resume/i,
      /review.*cover letter/i,
      /improve.*resume/i,
      /improve.*cover letter/i,
      /analyze.*resume/i,
      /analyze.*cover letter/i
    ];
    
    return documentPatterns.some(pattern => pattern.test(message));
  }
  
  private getDocumentType(message: string): string {
    if (/resume/i.test(message)) {
      return "resume";
    } else {
      return "coverLetter";
    }
  }
  
  // Voice processing is simplified to just text processing
  async processVoice(transcription: string, history: { role: string; content: string }[] = []): Promise<string> {
    return this.processMessage(transcription, history);
  }
  
  // Image analysis - simplified version
  async analyzeImage(imageDescription: string, prompt: string, history: { role: string; content: string }[] = []): Promise<string> {
    const combinedMessage = `[Image description: ${imageDescription}]\n\nUser question about the image: ${prompt}`;
    return this.processMessage(combinedMessage, history);
  }
}

// Create a singleton instance
export const simpleAssistant = new SimpleAssistant();