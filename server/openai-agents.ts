import OpenAI from "openai";

// Initialize standard OpenAI client for basic operations
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Note: We're removing the openai-agents import as it's causing errors
// We'll use the standard OpenAI client for all operations

// Create a simple Assistant for teachers in Assam - no vision or audio capabilities
export async function createTeacherAssistant() {
  // Create an assistant with the OpenAI Assistants API - minimal version
  const assistant = await openai.beta.assistants.create({
    name: "Assam Teacher Career Guide",
    description: "A specialized assistant for teachers in Assam providing personalized career guidance and job search help.",
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    tools: [], // Removing all tools to simplify and avoid errors
    instructions: `
You are an AI Assistant for Aguwai Jauk - a specialized job portal for teachers in Assam, India.

Your primary role is to provide personalized guidance to teachers looking for jobs in Assam. You offer:

1. Job search assistance: Help users find relevant teaching positions based on their qualifications, location preferences, and career goals.
2. Application advice: Provide guidance on preparing resumes, writing effective cover letters, and submitting strong applications.
3. Interview preparation: Offer tips on common interview questions for teaching positions and strategies for demonstrating teaching skills.
4. Career development: Suggest professional development opportunities, certifications, and skills that can enhance a teacher's prospects.
5. Regional insights: Share information about educational institutions, living conditions, and cultural aspects of different regions in Assam.

Always be respectful, culturally sensitive, and focus on providing accurate, practical information to help teachers advance their careers in Assam's education sector.

Keep your responses conversational but concise, and try to organize information clearly to make it easily digestible for users.
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

// Create a new teacher agent - using standard OpenAI API as a fallback
export async function createTeacherAgent() {
  // Instead of using openai-agents, we'll use the standard OpenAI Assistants API
  return await createTeacherAssistant();
}

// Process a message with the standard OpenAI API
export async function processAgentMessage(message: string) {
  try {
    // Create or get assistant
    const assistant = await createTeacherAssistant();
    
    // Create a new thread for the conversation
    const thread = await createThread();
    
    // Add the user message to the thread
    await addMessageToThread(thread.id, message);
    
    // Run the assistant on the thread
    const messages = await runAssistant(assistant.id, thread.id);
    
    // Get the latest assistant message
    const assistantMessages = messages.filter((msg: any) => msg.role === 'assistant');
    const latestMessage = assistantMessages[assistantMessages.length - 1];
    
    // Format the response to match the expected structure
    return {
      threadId: thread.id,
      agentId: assistant.id,
      messages: messages.map((msg: any) => {
        let content = "";
        if (msg.content && msg.content.length > 0) {
          const textContent = msg.content.find((c: any) => c.type === 'text');
          if (textContent && 'text' in textContent) {
            content = textContent.text.value;
          }
        }
        
        return {
          role: msg.role,
          content: content
        };
      })
    };
  } catch (error: any) {
    console.error("Error in processAgentMessage:", error);
    throw new Error(`Failed to process message: ${error.message || 'Unknown error'}`);
  }
}

// Process audio with the standard OpenAI API
export async function processVoiceWithAgent(audioFilePath: string) {
  try {
    // Create or get assistant
    const assistant = await createTeacherAssistant();
    
    // Create a new thread for the conversation
    const thread = await createThread();
    
    // Upload the audio file
    const fileId = await uploadFile(audioFilePath, "assistants_input");
    
    // Add the audio to the thread
    await addMessageToThread(thread.id, "", [fileId]);
    
    // Run the assistant on the thread
    const messages = await runAssistant(assistant.id, thread.id);
    
    // Format the response to match the expected structure
    return {
      threadId: thread.id,
      agentId: assistant.id,
      messages: messages.map((msg: any) => {
        let content = "";
        if (msg.content && msg.content.length > 0) {
          const textContent = msg.content.find((c: any) => c.type === 'text');
          if (textContent && 'text' in textContent) {
            content = textContent.text.value;
          }
        }
        
        return {
          role: msg.role,
          content: content
        };
      })
    };
  } catch (error: any) {
    console.error("Error in processVoiceWithAgent:", error);
    throw new Error(`Failed to process voice: ${error.message || 'Unknown error'}`);
  }
}

// Process image with the standard OpenAI API
export async function processImageWithAgent(imageFilePath: string, prompt: string) {
  try {
    // Create or get assistant
    const assistant = await createTeacherAssistant();
    
    // Create a new thread for the conversation
    const thread = await createThread();
    
    // Upload the image file
    const fileId = await uploadFile(imageFilePath, "assistants_input");
    
    // Add the image and prompt to the thread
    await addMessageToThread(thread.id, prompt, [fileId]);
    
    // Run the assistant on the thread
    const messages = await runAssistant(assistant.id, thread.id);
    
    // Format the response to match the expected structure
    return {
      threadId: thread.id,
      agentId: assistant.id,
      messages: messages.map((msg: any) => {
        let content = "";
        if (msg.content && msg.content.length > 0) {
          const textContent = msg.content.find((c: any) => c.type === 'text');
          if (textContent && 'text' in textContent) {
            content = textContent.text.value;
          }
        }
        
        return {
          role: msg.role,
          content: content
        };
      })
    };
  } catch (error: any) {
    console.error("Error in processImageWithAgent:", error);
    throw new Error(`Failed to process image: ${error.message || 'Unknown error'}`);
  }
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