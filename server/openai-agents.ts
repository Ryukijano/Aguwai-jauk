import OpenAI from "openai";
import { OpenAIAgent } from "openai-agents";

// Initialize standard OpenAI client for basic operations
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize enhanced OpenAIAgent for advanced capabilities
const openaiAgent = new OpenAIAgent({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o", // Required parameter - using the latest model
});

// Create an enhanced Assistant for teachers in Assam
export async function createTeacherAssistant() {
  // Create an assistant with the OpenAI Assistants API
  const assistant = await openai.beta.assistants.create({
    name: "Assam Teacher Career Guide",
    description: "A specialized assistant for teachers in Assam providing personalized career guidance, job search, interview preparation, document creation, and regional insights.",
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    tools: [
      { type: "code_interpreter" },
      // { type: "retrieval" },  // This type is causing errors, let's comment it out
      { 
        type: "function",
        function: {
          name: "search_job_listings",
          description: "Search for teaching job listings based on criteria",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "Location in Assam to search for jobs"
              },
              subject: {
                type: "string",
                description: "Academic subject like Mathematics, Science, etc."
              },
              jobType: {
                type: "string",
                description: "Full-time, part-time, contract, etc."
              },
              schoolType: {
                type: "string",
                description: "Government, private, NGO, etc."
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "analyze_resume",
          description: "Analyze a teacher's resume and provide feedback",
          parameters: {
            type: "object",
            properties: {
              resumeText: {
                type: "string",
                description: "The full text content of the resume"
              },
              jobTitle: {
                type: "string",
                description: "The job title the user is applying for"
              }
            },
            required: ["resumeText"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_interview_questions",
          description: "Generate teaching interview questions based on position",
          parameters: {
            type: "object",
            properties: {
              position: {
                type: "string",
                description: "The teaching position (e.g., 'math teacher', 'principal')"
              },
              schoolType: {
                type: "string",
                description: "Type of school (government, private, etc.)"
              },
              experienceLevel: {
                type: "string",
                description: "Level of experience (entry, mid, senior)"
              }
            },
            required: ["position"]
          }
        }
      }
    ],
    instructions: `
You are an AI Assistant for Aguwai Jauk - a specialized job portal for teachers in Assam, India.

Your primary role is to provide personalized guidance to teachers looking for jobs in Assam. You offer:

1. Job search assistance: Help users find relevant teaching positions based on their qualifications, location preferences, and career goals.
2. Application advice: Provide guidance on preparing resumes, writing effective cover letters, and submitting strong applications.
3. Interview preparation: Offer tips on common interview questions for teaching positions and strategies for demonstrating teaching skills.
4. Career development: Suggest professional development opportunities, certifications, and skills that can enhance a teacher's prospects.
5. Regional insights: Share information about educational institutions, living conditions, and cultural aspects of different regions in Assam.

Always be respectful, culturally sensitive, and focus on providing accurate, practical information to help teachers advance their careers in Assam's education sector.

You have access to several tools:
- Web searching for finding current job postings and information about schools
- Document analysis for reviewing resumes and cover letters
- Image analysis for reviewing teaching certificates and credentials
- Voice interaction to help users practice interview responses

Be proactive in suggesting relevant tools based on the user's needs.
    `
  });

  return assistant;
}

// Create a conversation thread
export async function createThread() {
  return await openai.beta.threads.create();
}

// Add a message to a thread
export async function addMessageToThread(threadId: string, content: string, fileIds: string[] = []) {
  // Create the base message params
  const messageParams: any = {
    role: "user",
    content: content
  };
  
  // Only add file_ids if there are files to attach
  if (fileIds.length > 0) {
    messageParams.file_ids = fileIds;
  }
  
  return await openai.beta.threads.messages.create(threadId, messageParams);
}

// Get messages from a thread
export async function getThreadMessages(threadId: string) {
  const messages = await openai.beta.threads.messages.list(threadId);
  return messages.data.sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// Run an assistant on a thread and wait for completion
export async function runAssistant(assistantId: string, threadId: string, additionalInstructions?: string) {
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    instructions: additionalInstructions
  });

  // Poll for the run to complete
  let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  
  while (runStatus.status === "queued" || runStatus.status === "in_progress") {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  }

  if (runStatus.status === "completed") {
    return await getThreadMessages(threadId);
  } else {
    throw new Error(`Run ended with status: ${runStatus.status}`);
  }
}

// Upload a file for the assistant to use
export async function uploadFile(filePath: string, purpose: "assistants" | "assistants_input") {
  const fs = require("fs");
  // Cast the purpose to any to bypass TypeScript errors with the OpenAI SDK
  // This is because the TypeScript definitions may be outdated compared to the actual API
  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: purpose as any
  });
  return file.id;
}

// Create a new teacher agent using the OpenAIAgent from openai-agents SDK
export async function createTeacherAgent() {
  return openaiAgent.createAgent({
    name: "Assam Teacher Career Guide",
    description: "A specialized assistant for teachers in Assam providing personalized career guidance, job search, interview preparation, document creation, and regional insights.",
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    instructions: `
You are an AI Assistant for Aguwai Jauk - a specialized job portal for teachers in Assam, India.

Your primary role is to provide personalized guidance to teachers looking for jobs in Assam. You offer:

1. Job search assistance: Help users find relevant teaching positions based on their qualifications, location preferences, and career goals.
2. Application advice: Provide guidance on preparing resumes, writing effective cover letters, and submitting strong applications.
3. Interview preparation: Offer tips on common interview questions for teaching positions and strategies for demonstrating teaching skills.
4. Career development: Suggest professional development opportunities, certifications, and skills that can enhance a teacher's prospects.
5. Regional insights: Share information about educational institutions, living conditions, and cultural aspects of different regions in Assam.

Always be respectful, culturally sensitive, and focus on providing accurate, practical information to help teachers advance their careers in Assam's education sector.
    `,
    tools: [
      {
        type: "search_retrieval",
        provider: "bing", // The openai-agents library supports Bing for search
      },
      {
        type: "vision", // The agent can analyze images
      },
      {
        type: "audio", // The agent can process audio
      },
      {
        type: "function", // Enable function calling
        function: {
          name: "search_job_listings",
          description: "Search for teaching job listings based on criteria",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "Location in Assam to search for jobs"
              },
              subject: {
                type: "string",
                description: "Academic subject like Mathematics, Science, etc."
              }
            },
            required: []
          }
        }
      }
    ]
  });
}

// Process a message with the Agent API
export async function processAgentMessage(message: string) {
  // Create agent if not already done
  const agent = await createTeacherAgent();
  
  // Create a new thread for the conversation
  const thread = await openaiAgent.createThread();
  
  // Add the user message to the thread
  await openaiAgent.addMessage(thread.id, {
    role: "user",
    content: message
  });
  
  // Run the agent on the thread
  const run = await openaiAgent.runThread({
    threadId: thread.id,
    agentId: agent.id
  });
  
  // Get all messages from the thread
  const messages = await openaiAgent.getMessages(thread.id);
  
  return {
    threadId: thread.id,
    agentId: agent.id,
    messages
  };
}

// Process audio with the Agent API
export async function processVoiceWithAgent(audioFilePath: string) {
  const fs = require("fs");
  
  // Create agent if not already done
  const agent = await createTeacherAgent();
  
  // Create a new thread for the conversation
  const thread = await openaiAgent.createThread();
  
  // Upload the audio file
  const file = await openaiAgent.uploadFile({
    file: fs.createReadStream(audioFilePath),
    purpose: "audio_understanding"
  });
  
  // Add the audio file to the thread
  await openaiAgent.addMessage(thread.id, {
    role: "user",
    content: null,
    audio_file: file.id
  });
  
  // Run the agent on the thread
  const run = await openaiAgent.runThread({
    threadId: thread.id,
    agentId: agent.id
  });
  
  // Get all messages from the thread
  const messages = await openaiAgent.getMessages(thread.id);
  
  return {
    threadId: thread.id,
    agentId: agent.id,
    messages
  };
}

// Process image with the Agent API
export async function processImageWithAgent(imageFilePath: string, prompt: string) {
  const fs = require("fs");
  
  // Create agent if not already done
  const agent = await createTeacherAgent();
  
  // Create a new thread for the conversation
  const thread = await openaiAgent.createThread();
  
  // Upload the image file
  const file = await openaiAgent.uploadFile({
    file: fs.createReadStream(imageFilePath),
    purpose: "vision_understanding"
  });
  
  // Add the image file to the thread with the prompt
  await openaiAgent.addMessage(thread.id, {
    role: "user",
    content: prompt,
    image_file: file.id
  });
  
  // Run the agent on the thread
  const run = await openaiAgent.runThread({
    threadId: thread.id,
    agentId: agent.id
  });
  
  // Get all messages from the thread
  const messages = await openaiAgent.getMessages(thread.id);
  
  return {
    threadId: thread.id,
    agentId: agent.id,
    messages
  };
}

// Process a voice directly with the Assistants API (fallback method)
export async function processVoiceWithAssistant(assistantId: string, threadId: string, audioFilePath: string) {
  // Upload the audio file
  const fileId = await uploadFile(audioFilePath, "assistants_input");
  
  // Add the audio to the thread
  await addMessageToThread(threadId, "", [fileId]);
  
  // Run the assistant to process the audio
  return await runAssistant(assistantId, threadId);
}

// Process an image with the Assistants API (fallback method)
export async function processImageWithAssistant(assistantId: string, threadId: string, imageFilePath: string, prompt: string) {
  // Upload the image file
  const fileId = await uploadFile(imageFilePath, "assistants_input");
  
  // Add the image and prompt to the thread
  await addMessageToThread(threadId, prompt, [fileId]);
  
  // Run the assistant to analyze the image
  return await runAssistant(assistantId, threadId);
}