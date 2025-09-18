import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { IStorage } from '../storage';
import type { Request, Response } from 'express';
import type { User } from '@shared/schema';
import { analyzeResumeWithAI, ResumeAnalysis } from '../services/resume-analysis-service';
import { matchResumeToJobs } from '../services/job-matching-service';

// Extend Express Request type for user
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'resumes');
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `resume-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
    }
  }
});

// Helper function to extract text from PDF
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return '';
  }
}

// Helper function to extract text from DOCX
async function extractTextFromDOCX(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    return '';
  }
}

// Helper function to parse resume content with AI analysis
async function parseResumeContent(filePath: string, mimeType: string): Promise<{ parsedData: string; aiAnalysis: ResumeAnalysis | null }> {
  let text = '';
  
  if (mimeType === 'application/pdf') {
    text = await extractTextFromPDF(filePath);
  } else if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
    text = await extractTextFromDOCX(filePath);
  }
  
  // Basic text processing - remove extra whitespace, normalize
  text = text.replace(/\s+/g, ' ').trim();
  
  // Try to get AI analysis
  let aiAnalysis: ResumeAnalysis | null = null;
  try {
    console.log('Performing AI analysis on resume...');
    aiAnalysis = await analyzeResumeWithAI(text);
    console.log('AI analysis completed successfully');
  } catch (error) {
    console.error('AI analysis failed, falling back to basic extraction:', error);
  }
  
  // Combine basic extraction with AI analysis if available
  const parsedData = {
    fullText: text.substring(0, 10000), // Limit stored text
    extractedAt: new Date().toISOString(),
    // Use AI-extracted data if available, otherwise fall back to basic extraction
    skills: aiAnalysis?.extractedData?.skills || extractSkills(text),
    experience: aiAnalysis?.extractedData?.experience || extractExperience(text),
    education: aiAnalysis?.extractedData?.education || extractEducation(text),
    certifications: aiAnalysis?.extractedData?.certifications || [],
    // Include full AI analysis if available
    aiAnalysis: aiAnalysis || null
  };
  
  return {
    parsedData: JSON.stringify(parsedData),
    aiAnalysis
  };
}

// Basic skill extraction (can be enhanced)
function extractSkills(text: string): string[] {
  const commonSkills = [
    'teaching', 'mathematics', 'science', 'english', 'hindi', 'physics', 
    'chemistry', 'biology', 'computer', 'programming', 'management',
    'communication', 'leadership', 'curriculum', 'assessment', 'classroom',
    'pedagogy', 'educational', 'primary', 'secondary', 'cbse', 'icse'
  ];
  
  const foundSkills = commonSkills.filter(skill => 
    text.toLowerCase().includes(skill)
  );
  
  return Array.from(new Set(foundSkills));
}

// Basic experience extraction
function extractExperience(text: string): string {
  const expPattern = /(\d+)\s*(years?|yrs?)\s*(of)?\s*experience/i;
  const match = text.match(expPattern);
  return match ? match[0] : '';
}

// Basic education extraction  
function extractEducation(text: string): string {
  const degrees = ['B.Ed', 'M.Ed', 'B.A', 'M.A', 'B.Sc', 'M.Sc', 'PhD', 'D.El.Ed', 'TET', 'CTET'];
  const found = degrees.filter(degree => 
    text.includes(degree) || text.toLowerCase().includes(degree.toLowerCase())
  );
  return found.join(', ');
}

export default function createResumeManagementRoutes(storage: IStorage) {
  const router = Router();
  
  // Upload a new resume
  router.post('/api/documents/resume', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
      // Check resume count limit (max 5 per user)
      const existingResumes = await storage.getUserResumes(req.user.id);
      if (existingResumes.length >= 5) {
        // Delete uploaded file
        await fs.unlink(req.file.path);
        return res.status(400).json({ 
          error: 'Resume limit reached. Please delete an existing resume before uploading a new one.' 
        });
      }
      
      // Parse resume content with AI analysis
      const { parsedData, aiAnalysis } = await parseResumeContent(req.file.path, req.file.mimetype);
      
      // Create document record
      const document = await storage.createDocument({
        userId: req.user.id,
        type: 'resume',
        name: req.file.originalname,
        url: `/uploads/resumes/${req.file.filename}`,
        size: req.file.size,
        mimeType: req.file.mimetype,
        parsedData
      });
      
      // If this is the first resume, set it as default
      if (existingResumes.length === 0) {
        await storage.setDefaultResume(req.user.id, document.id);
        document.isDefault = true;
      }
      
      // Include AI analysis in response
      const response: any = {
        success: true,
        document: {
          id: document.id,
          name: document.name,
          size: document.size,
          mimeType: document.mimeType,
          isDefault: document.isDefault,
          uploadedAt: document.uploadedAt
        }
      };
      
      // Add AI analysis to response if available
      if (aiAnalysis) {
        response.analysis = {
          overallScore: aiAnalysis.overallScore,
          qualificationScore: aiAnalysis.qualificationScore,
          extractedData: {
            skills: aiAnalysis.extractedData.skills,
            education: aiAnalysis.extractedData.education,
            experience: aiAnalysis.extractedData.experience,
            certifications: aiAnalysis.extractedData.certifications
          },
          strengths: aiAnalysis.strengths,
          improvements: aiAnalysis.improvements,
          recommendations: aiAnalysis.recommendations,
          jobMatches: aiAnalysis.jobMatches,
          confidence: aiAnalysis.confidence
        };
      }
      
      res.json(response);
    } catch (error) {
      console.error('Resume upload error:', error);
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(500).json({ error: 'Failed to upload resume' });
    }
  });
  
  // Get user's resumes
  router.get('/api/documents/resumes', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const resumes = await storage.getUserResumes(req.user.id);
      
      // Format response with AI analysis if available
      const formattedResumes = resumes.map(resume => {
        const baseInfo = {
          id: resume.id,
          name: resume.name,
          size: resume.size,
          mimeType: resume.mimeType,
          isDefault: resume.isDefault,
          url: resume.url,
          uploadedAt: resume.uploadedAt
        };
        
        // Try to parse and include AI analysis if available
        try {
          if (resume.parsedData) {
            const parsed = JSON.parse(resume.parsedData);
            if (parsed.aiAnalysis) {
              return {
                ...baseInfo,
                analysis: {
                  overallScore: parsed.aiAnalysis.overallScore,
                  confidence: parsed.aiAnalysis.confidence
                }
              };
            }
          }
        } catch (e) {
          // If parsing fails, just return base info
        }
        
        return baseInfo;
      });
      
      res.json({
        resumes: formattedResumes,
        count: formattedResumes.length,
        limit: 5
      });
    } catch (error) {
      console.error('Error fetching resumes:', error);
      res.status(500).json({ error: 'Failed to fetch resumes' });
    }
  });
  
  // Set default resume
  router.patch('/api/documents/:id/default', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    try {
      // Verify document belongs to user and is a resume
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Resume not found' });
      }
      
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (document.type.toLowerCase() !== 'resume') {
        return res.status(400).json({ error: 'Document is not a resume' });
      }
      
      // Set as default
      const success = await storage.setDefaultResume(req.user.id, documentId);
      
      if (success) {
        res.json({ success: true, message: 'Default resume updated' });
      } else {
        res.status(500).json({ error: 'Failed to update default resume' });
      }
    } catch (error) {
      console.error('Error setting default resume:', error);
      res.status(500).json({ error: 'Failed to update default resume' });
    }
  });
  
  // Delete resume
  router.delete('/api/documents/:id', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    try {
      // Verify document belongs to user
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Delete file from filesystem
      if (document.url) {
        const filePath = path.join(process.cwd(), document.url);
        await fs.unlink(filePath).catch(err => {
          console.error('Error deleting file:', err);
        });
      }
      
      // Delete database record
      const success = await storage.deleteUserDocument(req.user.id, documentId);
      
      if (success) {
        res.json({ success: true, message: 'Resume deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete resume' });
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
      res.status(500).json({ error: 'Failed to delete resume' });
    }
  });
  
  // Get default resume for quick apply
  router.get('/api/documents/default-resume', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const resumes = await storage.getUserResumes(req.user.id);
      const defaultResume = resumes.find(r => r.isDefault);
      
      if (defaultResume) {
        // Try to include AI analysis if available
        let analysis = null;
        try {
          if (defaultResume.parsedData) {
            const parsed = JSON.parse(defaultResume.parsedData);
            if (parsed.aiAnalysis) {
              analysis = {
                overallScore: parsed.aiAnalysis.overallScore,
                confidence: parsed.aiAnalysis.confidence
              };
            }
          }
        } catch (e) {
          // If parsing fails, just skip analysis
        }
        
        res.json({
          id: defaultResume.id,
          name: defaultResume.name,
          url: defaultResume.url,
          analysis
        });
      } else {
        res.json({ id: null, name: null, url: null, analysis: null });
      }
    } catch (error) {
      console.error('Error fetching default resume:', error);
      res.status(500).json({ error: 'Failed to fetch default resume' });
    }
  });
  
  // Get job matches for user's default resume
  router.get('/api/resume/job-matches', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      // Check if user has cached job matches
      const cachedMatches = await storage.getJobMatches(req.user.id);
      if (cachedMatches && cachedMatches.length > 0) {
        // Check if cache is recent (within 24 hours)
        const cacheAge = Date.now() - new Date(cachedMatches[0].created_at).getTime();
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return res.json({
            matches: cachedMatches,
            cached: true
          });
        }
      }
      
      // Get user's default resume
      const resumes = await storage.getUserResumes(req.user.id);
      const defaultResume = resumes.find(r => r.isDefault) || resumes[0];
      
      if (!defaultResume || !defaultResume.parsedData) {
        return res.json({
          matches: [],
          message: 'Please upload a resume to get job matches'
        });
      }
      
      // Parse resume data to get AI analysis
      let resumeAnalysis: ResumeAnalysis | null = null;
      try {
        const parsedData = JSON.parse(defaultResume.parsedData);
        resumeAnalysis = parsedData.aiAnalysis;
      } catch (e) {
        console.error('Error parsing resume data:', e);
        return res.json({
          matches: [],
          error: 'Resume analysis not available'
        });
      }
      
      if (!resumeAnalysis) {
        return res.json({
          matches: [],
          message: 'Resume needs to be analyzed first'
        });
      }
      
      // Get all active jobs
      const jobs = await storage.getJobListings({ });
      const activeJobs = jobs.filter(j => j.isActive !== false);
      
      if (activeJobs.length === 0) {
        return res.json({
          matches: [],
          message: 'No active jobs available'
        });
      }
      
      // Get user's location from profile
      const user = await storage.getUserById(req.user.id);
      const userLocation = user?.preferredLocations?.[0] || user?.address;
      
      // Perform matching
      const matches = await matchResumeToJobs(
        resumeAnalysis,
        activeJobs,
        userLocation
      );
      
      // Save matches to database for caching
      await storage.saveJobMatches(req.user.id, defaultResume.id, matches);
      
      // Return top matches
      const topMatches = matches.slice(0, 20);
      
      res.json({
        matches: topMatches,
        totalJobs: activeJobs.length,
        resumeId: defaultResume.id,
        cached: false
      });
    } catch (error) {
      console.error('Error generating job matches:', error);
      res.status(500).json({ error: 'Failed to generate job matches' });
    }
  });
  
  // Force refresh job matches
  router.post('/api/resume/job-matches/refresh', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      // Clear existing matches
      await storage.clearUserJobMatches(req.user.id);
      
      // Get user's default resume
      const resumes = await storage.getUserResumes(req.user.id);
      const defaultResume = resumes.find(r => r.isDefault) || resumes[0];
      
      if (!defaultResume || !defaultResume.parsedData) {
        return res.json({
          success: false,
          message: 'Please upload a resume to get job matches'
        });
      }
      
      // Parse resume data
      let resumeAnalysis: ResumeAnalysis | null = null;
      try {
        const parsedData = JSON.parse(defaultResume.parsedData);
        resumeAnalysis = parsedData.aiAnalysis;
      } catch (e) {
        return res.json({
          success: false,
          error: 'Resume analysis not available'
        });
      }
      
      if (!resumeAnalysis) {
        return res.json({
          success: false,
          message: 'Resume needs to be analyzed first'
        });
      }
      
      // Get all active jobs and user location
      const jobs = await storage.getJobListings({ });
      const activeJobs = jobs.filter(j => j.isActive !== false);
      const user = await storage.getUserById(req.user.id);
      const userLocation = user?.preferredLocations?.[0] || user?.address;
      
      // Perform matching
      const matches = await matchResumeToJobs(
        resumeAnalysis,
        activeJobs,
        userLocation
      );
      
      // Save new matches
      await storage.saveJobMatches(req.user.id, defaultResume.id, matches);
      
      res.json({
        success: true,
        matches: matches.slice(0, 20),
        totalMatched: matches.length
      });
    } catch (error) {
      console.error('Error refreshing job matches:', error);
      res.status(500).json({ error: 'Failed to refresh job matches' });
    }
  });
  
  // Get match score for specific jobs
  router.post('/api/resume/job-matches/batch', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const { jobIds } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'Job IDs array required' });
    }
    
    try {
      // Get cached matches for these specific jobs
      const matches: any[] = [];
      
      for (const jobId of jobIds) {
        const match = await storage.getJobMatchByUserAndJob(req.user.id, jobId);
        if (match) {
          matches.push({
            jobId,
            matchScore: match.match_score,
            recommendationLevel: match.recommendation_level
          });
        }
      }
      
      res.json({ matches });
    } catch (error) {
      console.error('Error fetching batch job matches:', error);
      res.status(500).json({ error: 'Failed to fetch job matches' });
    }
  });
  
  return router;
}