import OpenAI from "openai";
import { JobListing } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy-key" });

export async function analyzeJobDescription(description: string): Promise<{
  keyRequirements: string[];
  suggestedSkills: string[];
  applicationTips: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert career counselor specializing in education and teaching jobs. Analyze job descriptions and provide structured insights."
        },
        {
          role: "user",
          content: `Analyze this teaching job description and provide: 
          1. Key requirements (as bullet points)
          2. Suggested skills candidates should highlight
          3. Application tips
          
          Format your response as JSON with the keys: keyRequirements (array), suggestedSkills (array), and applicationTips (string).
          
          Job Description: ${description}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      keyRequirements: result.keyRequirements,
      suggestedSkills: result.suggestedSkills,
      applicationTips: result.applicationTips
    };
  } catch (error) {
    console.error("Error analyzing job description:", error);
    return {
      keyRequirements: ["Unable to analyze requirements"],
      suggestedSkills: ["Unable to analyze skills"],
      applicationTips: "Unable to generate application tips. Please try again later."
    };
  }
}

export async function generateInterviewQuestions(job: Partial<JobListing>): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an experienced school administrator who conducts interviews for teaching positions."
        },
        {
          role: "user",
          content: `Generate 5 likely interview questions for a ${job.title} position at ${job.organization} in ${job.location}. 
          Job details: ${job.description}
          Requirements: ${job.requirements}
          
          Return only an array of questions in JSON format.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return Array.isArray(result.questions) ? result.questions : [];
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return [
      "Tell me about your teaching experience",
      "What is your teaching philosophy?",
      "How do you handle classroom management?",
      "How do you assess student learning?",
      "Why do you want to work at our institution?"
    ];
  }
}

export async function getAIResponse(userId: number, message: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an AI career assistant specializing in helping teachers find and apply for jobs in Assam, India. Your name is Aguwai Assistant. Provide helpful, supportive, and concise advice. Respond in a friendly tone. Do not generate URLs or claim to be built by any specific company. Your purpose is to help teachers with job searching, application advice, and interview preparation."
        },
        {
          role: "user", 
          content: message
        }
      ]
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't process that. Please try again.";
  } catch (error) {
    console.error("Error getting AI response:", error);
    return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
  }
}

export async function suggestResumeImprovements(resume: string): Promise<{
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert resume reviewer for educational professionals."
        },
        {
          role: "user",
          content: `Review this teacher's resume and provide feedback:
          1. Identify 3 strengths
          2. Identify 3 potential weaknesses or areas for improvement
          3. Suggest 3 specific improvements
          
          Format your response as JSON with the keys: strengths (array), weaknesses (array), and suggestions (array).
          
          Resume content: ${resume}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      suggestions: result.suggestions
    };
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return {
      strengths: ["Unable to analyze strengths"],
      weaknesses: ["Unable to analyze areas for improvement"],
      suggestions: ["Unable to generate suggestions"]
    };
  }
}
