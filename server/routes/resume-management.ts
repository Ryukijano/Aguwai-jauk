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

// Helper function to parse resume content
async function parseResumeContent(filePath: string, mimeType: string): Promise<string> {
  let text = '';
  
  if (mimeType === 'application/pdf') {
    text = await extractTextFromPDF(filePath);
  } else if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
    text = await extractTextFromDOCX(filePath);
  }
  
  // Basic text processing - remove extra whitespace, normalize
  text = text.replace(/\s+/g, ' ').trim();
  
  // Extract key information (basic implementation)
  const parsedData = {
    fullText: text.substring(0, 10000), // Limit stored text
    extractedAt: new Date().toISOString(),
    // Add more sophisticated parsing here if needed
    skills: extractSkills(text),
    experience: extractExperience(text),
    education: extractEducation(text)
  };
  
  return JSON.stringify(parsedData);
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
      
      // Parse resume content
      const parsedData = await parseResumeContent(req.file.path, req.file.mimetype);
      
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
      
      res.json({
        success: true,
        document: {
          id: document.id,
          name: document.name,
          size: document.size,
          mimeType: document.mimeType,
          isDefault: document.isDefault,
          uploadedAt: document.uploadedAt
        }
      });
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
      
      // Format response
      const formattedResumes = resumes.map(resume => ({
        id: resume.id,
        name: resume.name,
        size: resume.size,
        mimeType: resume.mimeType,
        isDefault: resume.isDefault,
        url: resume.url,
        uploadedAt: resume.uploadedAt
      }));
      
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
        res.json({
          id: defaultResume.id,
          name: defaultResume.name,
          url: defaultResume.url
        });
      } else {
        res.json({ id: null, name: null, url: null });
      }
    } catch (error) {
      console.error('Error fetching default resume:', error);
      res.status(500).json({ error: 'Failed to fetch default resume' });
    }
  });
  
  return router;
}