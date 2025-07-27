import { z } from 'zod';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { JobListing, User } from '@shared/schema';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Agent function schemas
const searchJobsSchema = z.object({
  location: z.string().optional().describe('Location to filter jobs (e.g., "Guwahati", "Dibrugarh")'),
  jobType: z.string().optional().describe('Type of job (e.g., "full-time", "part-time", "contract")'),
  category: z.string().optional().describe('Teaching category (e.g., "primary", "secondary", "college")'),
  keywords: z.string().optional().describe('Keywords to search in job titles and descriptions')
});

const analyzeResumeSchema = z.object({
  resumeContent: z.string().describe('The text content of the resume to analyze'),
  targetJobId: z.number().optional().describe('ID of the specific job to match against')
});

const prepareInterviewSchema = z.object({
  jobTitle: z.string().describe('Title of the job position'),
  school: z.string().describe('Name of the school or institution'),
  category: z.string().optional().describe('Teaching category (primary, secondary, etc.)')
});

const trackApplicationSchema = z.object({
  applicationId: z.number().describe('ID of the application to track')
});

// Agent function definitions
export const agentFunctions = [
  {
    name: 'search_jobs',
    description: 'Search for teaching jobs based on various criteria',
    parameters: searchJobsSchema
  },
  {
    name: 'analyze_resume',
    description: 'Analyze a resume and provide feedback on strengths, weaknesses, and job matching',
    parameters: analyzeResumeSchema
  },
  {
    name: 'prepare_interview',
    description: 'Generate interview questions and preparation tips for a specific teaching position',
    parameters: prepareInterviewSchema
  },
  {
    name: 'track_application',
    description: 'Track the status of a job application',
    parameters: trackApplicationSchema
  }
];

// Agent function implementations
export async function executeAgentFunction(
  functionName: string,
  args: any,
  context: { storage: any; userId?: number }
): Promise<any> {
  switch (functionName) {
    case 'search_jobs':
      return searchJobs(args, context);
    case 'analyze_resume':
      return analyzeResume(args, context);
    case 'prepare_interview':
      return prepareInterview(args, context);
    case 'track_application':
      return trackApplication(args, context);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

async function searchJobs(args: z.infer<typeof searchJobsSchema>, context: any) {
  const { location, jobType, category, keywords } = args;
  
  // Get jobs from storage with filters
  const jobs = await context.storage.getJobListings({
    location,
    category,
    search: keywords
  });
  
  // Filter by job type if specified
  let filteredJobs = jobs;
  if (jobType) {
    filteredJobs = jobs.filter(job => 
      job.jobType?.toLowerCase().includes(jobType.toLowerCase())
    );
  }
  
  return {
    count: filteredJobs.length,
    jobs: filteredJobs.slice(0, 10).map(job => ({
      id: job.id,
      title: job.title,
      organization: job.organization,
      location: job.location,
      type: job.jobType,
      category: job.category,
      salary: job.salary,
      deadline: job.applicationDeadline,
      summary: job.description.substring(0, 150) + '...'
    }))
  };
}

async function analyzeResume(args: z.infer<typeof analyzeResumeSchema>, context: any) {
  const { resumeContent, targetJobId } = args;
  
  let targetJob;
  if (targetJobId) {
    targetJob = await context.storage.getJobListing(targetJobId);
  }
  
  // Use Gemini for resume analysis
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = `Analyze this teaching resume and provide:
1. Key strengths (3-5 points)
2. Areas for improvement (2-3 points)
3. Overall match score (0-100) for teaching positions in Assam
${targetJob ? `4. Specific match analysis for: ${targetJob.title} at ${targetJob.organization}` : ''}

Resume content:
${resumeContent}`;
  
  const result = await model.generateContent(prompt);
  const analysis = result.response.text();
  
  return {
    analysis,
    targetJob: targetJob ? {
      title: targetJob.title,
      organization: targetJob.organization
    } : null
  };
}

async function prepareInterview(args: z.infer<typeof prepareInterviewSchema>, context: any) {
  const { jobTitle, school, category } = args;
  
  // Use OpenAI for interview preparation
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'You are an expert career coach specializing in teacher interviews in Assam.'
    }, {
      role: 'user',
      content: `Generate interview preparation for:
Position: ${jobTitle}
School: ${school}
Category: ${category || 'General'}

Please provide:
1. 5 likely interview questions specific to this role
2. Sample answers or key points for each question
3. 3 important tips for this specific school/position
4. Questions the candidate should ask the interviewer`
    }],
    temperature: 0.7
  });
  
  return {
    preparation: completion.choices[0].message.content,
    jobDetails: {
      title: jobTitle,
      school,
      category
    }
  };
}

async function trackApplication(args: z.infer<typeof trackApplicationSchema>, context: any) {
  const { applicationId } = args;
  
  if (!context.userId) {
    throw new Error('User must be logged in to track applications');
  }
  
  const application = await context.storage.getApplication(applicationId);
  
  if (!application || application.userId !== context.userId) {
    throw new Error('Application not found or access denied');
  }
  
  const job = await context.storage.getJobListing(application.jobId);
  
  return {
    applicationId: application.id,
    status: application.status,
    appliedDate: application.appliedAt,
    interviewDate: application.interviewDate,
    notes: application.notes,
    job: job ? {
      title: job.title,
      organization: job.organization,
      location: job.location
    } : null
  };
}