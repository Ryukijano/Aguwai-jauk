import { GoogleGenerativeAI } from "@google/generative-ai";

// Define the structure for resume analysis
export interface ResumeAnalysis {
  overallScore: number;
  qualificationScore: {
    education: number;
    experience: number;
    certifications: number;
    skills: number;
  };
  extractedData: {
    skills: string[];
    education: string[];
    experience: string;
    certifications: string[];
  };
  strengths: string[];
  improvements: string[];
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  jobMatches: {
    government: number;
    private: number;
    centralSchools: number;
  };
  confidence: number;
  analysisTimestamp: string;
}

// Cache for storing recent analyses to avoid re-processing
const analysisCache = new Map<string, { analysis: ResumeAnalysis; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Function to generate a cache key from resume text
function generateCacheKey(resumeText: string): string {
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < resumeText.length; i++) {
    const char = resumeText.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `resume_${hash}_${resumeText.length}`;
}

// Main function to analyze resume with Gemini AI
export async function analyzeResumeWithAI(resumeText: string): Promise<ResumeAnalysis> {
  // Check cache first
  const cacheKey = generateCacheKey(resumeText);
  const cached = analysisCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached resume analysis');
    return cached.analysis;
  }

  try {
    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        topK: 20,
        topP: 0.9,
        maxOutputTokens: 4096,
      }
    });

    // Comprehensive prompt for teaching resume analysis
    const prompt = `You are an expert resume analyst specializing in teaching positions in India, particularly Assam.
Analyze the following resume text and provide a comprehensive evaluation for teaching job applications.

RESUME TEXT:
${resumeText}

ANALYSIS REQUIREMENTS:
Provide a detailed JSON response with the following structure:

{
  "overallScore": (0-100, based on completeness, relevance, and competitiveness for teaching roles),
  "qualificationScore": {
    "education": (0-100, based on degrees like B.Ed, M.Ed, B.A, M.A, PhD, etc.),
    "experience": (0-100, based on teaching experience years and quality),
    "certifications": (0-100, based on TET, CTET, HTET, other teaching certifications),
    "skills": (0-100, based on relevant teaching and technical skills)
  },
  "extractedData": {
    "skills": [List all teaching, subject, technical, and soft skills found],
    "education": [List all degrees and educational qualifications with institutions if mentioned],
    "experience": "Summary of total experience and key roles",
    "certifications": [List all certifications, especially TET, CTET, etc.]
  },
  "strengths": [3-5 key strengths as a teaching candidate],
  "improvements": [2-3 areas that could be improved for better job prospects],
  "recommendations": {
    "immediate": [2-3 actions they can take immediately to improve their profile],
    "shortTerm": [2-3 goals for next 3-6 months],
    "longTerm": [2-3 career development goals for 1-2 years]
  },
  "jobMatches": {
    "government": (0-100, match percentage for government teaching jobs),
    "private": (0-100, match percentage for private school jobs),
    "centralSchools": (0-100, match percentage for KVS/NVS/Central schools)
  },
  "confidence": (0.0-1.0, your confidence level in this analysis),
  "analysisNotes": "Brief explanation of scoring rationale"
}

Consider these factors for scoring:
1. Educational qualifications (B.Ed is essential for teaching)
2. Teaching experience (years and relevance)
3. Subject expertise and specializations
4. Language proficiencies (especially for Assam: Assamese, English, Hindi)
5. Teaching certifications (TET, CTET are highly valued)
6. Digital literacy and modern teaching methods
7. Research publications or academic achievements
8. Extracurricular activities and holistic development

Be specific, constructive, and actionable in your recommendations.
Return ONLY valid JSON without any additional text or markdown formatting.`;

    // Get AI analysis
    const result = await model.generateContent(prompt);
    const response = result.response;
    let analysisText = response.text();
    
    // Clean the response to ensure valid JSON
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse the JSON response
    let analysis: any;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw response:', analysisText);
      
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not extract valid JSON from AI response');
      }
    }
    
    // Ensure all required fields are present with defaults
    const finalAnalysis: ResumeAnalysis = {
      overallScore: analysis.overallScore || 50,
      qualificationScore: {
        education: analysis.qualificationScore?.education || 0,
        experience: analysis.qualificationScore?.experience || 0,
        certifications: analysis.qualificationScore?.certifications || 0,
        skills: analysis.qualificationScore?.skills || 0
      },
      extractedData: {
        skills: analysis.extractedData?.skills || [],
        education: analysis.extractedData?.education || [],
        experience: analysis.extractedData?.experience || '',
        certifications: analysis.extractedData?.certifications || []
      },
      strengths: analysis.strengths || [],
      improvements: analysis.improvements || [],
      recommendations: {
        immediate: analysis.recommendations?.immediate || [],
        shortTerm: analysis.recommendations?.shortTerm || [],
        longTerm: analysis.recommendations?.longTerm || []
      },
      jobMatches: {
        government: analysis.jobMatches?.government || 0,
        private: analysis.jobMatches?.private || 0,
        centralSchools: analysis.jobMatches?.centralSchools || 0
      },
      confidence: analysis.confidence || 0.8,
      analysisTimestamp: new Date().toISOString()
    };
    
    // Cache the result
    analysisCache.set(cacheKey, {
      analysis: finalAnalysis,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (analysisCache.size > 100) {
      const entries = Array.from(analysisCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      analysisCache.delete(entries[0][0]);
    }
    
    return finalAnalysis;
  } catch (error) {
    console.error('Error in AI resume analysis:', error);
    
    // Return a basic analysis based on keyword matching if AI fails
    return getFallbackAnalysis(resumeText);
  }
}

// Fallback analysis using basic keyword matching
function getFallbackAnalysis(resumeText: string): ResumeAnalysis {
  const text = resumeText.toLowerCase();
  
  // Extract basic information using keyword matching
  const skills = extractSkillsBasic(text);
  const education = extractEducationBasic(text);
  const certifications = extractCertificationsBasic(text);
  const experienceYears = extractExperienceYears(text);
  
  // Calculate basic scores
  const educationScore = calculateEducationScore(education);
  const experienceScore = calculateExperienceScore(experienceYears);
  const certificationScore = calculateCertificationScore(certifications);
  const skillsScore = calculateSkillsScore(skills);
  
  const overallScore = Math.round(
    (educationScore * 0.3 + 
     experienceScore * 0.25 + 
     certificationScore * 0.2 + 
     skillsScore * 0.25)
  );
  
  return {
    overallScore,
    qualificationScore: {
      education: educationScore,
      experience: experienceScore,
      certifications: certificationScore,
      skills: skillsScore
    },
    extractedData: {
      skills,
      education,
      experience: `${experienceYears} years of experience`,
      certifications
    },
    strengths: generateStrengths(education, certifications, skills),
    improvements: generateImprovements(education, certifications, experienceYears),
    recommendations: {
      immediate: [
        "Update your resume with latest achievements",
        "Highlight your teaching methodologies"
      ],
      shortTerm: [
        "Complete any pending certifications",
        "Gain experience in digital teaching tools"
      ],
      longTerm: [
        "Consider pursuing higher qualifications",
        "Build expertise in specialized subjects"
      ]
    },
    jobMatches: {
      government: certifications.length > 0 ? 70 : 40,
      private: skills.length > 5 ? 60 : 40,
      centralSchools: (certifications.includes('CTET') || certifications.includes('TET')) ? 75 : 45
    },
    confidence: 0.5,
    analysisTimestamp: new Date().toISOString()
  };
}

// Helper functions for fallback analysis
function extractSkillsBasic(text: string): string[] {
  const skillKeywords = [
    'teaching', 'mathematics', 'science', 'english', 'hindi', 'physics',
    'chemistry', 'biology', 'computer', 'programming', 'management',
    'communication', 'leadership', 'curriculum', 'assessment', 'classroom',
    'pedagogy', 'educational', 'primary', 'secondary', 'cbse', 'icse',
    'digital', 'online teaching', 'ms office', 'smart board', 'research'
  ];
  
  return skillKeywords.filter(skill => text.includes(skill));
}

function extractEducationBasic(text: string): string[] {
  const degrees = ['b.ed', 'm.ed', 'b.a', 'm.a', 'b.sc', 'm.sc', 'phd', 'd.el.ed', 'bachelor', 'master', 'doctorate'];
  const found: string[] = [];
  
  degrees.forEach(degree => {
    if (text.includes(degree)) {
      found.push(degree.toUpperCase());
    }
  });
  
  return found;
}

function extractCertificationsBasic(text: string): string[] {
  const certs = ['tet', 'ctet', 'htet', 'stet', 'net', 'set', 'gate'];
  const found: string[] = [];
  
  certs.forEach(cert => {
    if (text.includes(cert)) {
      found.push(cert.toUpperCase());
    }
  });
  
  return found;
}

function extractExperienceYears(text: string): number {
  const patterns = [
    /(\d+)\s*(?:\+\s*)?years?\s*(?:of\s*)?experience/i,
    /experience\s*(?:of\s*)?(\d+)\s*(?:\+\s*)?years?/i,
    /(\d+)\s*(?:\+\s*)?yrs?\s*(?:of\s*)?exp/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
  }
  
  return 0;
}

function calculateEducationScore(education: string[]): number {
  let score = 0;
  if (education.some(e => e.includes('B.ED') || e.includes('D.EL.ED'))) score += 40;
  if (education.some(e => e.includes('M.ED'))) score += 20;
  if (education.some(e => e.includes('M.A') || e.includes('M.SC'))) score += 15;
  if (education.some(e => e.includes('PHD'))) score += 25;
  return Math.min(score, 100);
}

function calculateExperienceScore(years: number): number {
  if (years === 0) return 20;
  if (years <= 2) return 40;
  if (years <= 5) return 60;
  if (years <= 10) return 80;
  return 100;
}

function calculateCertificationScore(certifications: string[]): number {
  let score = 0;
  if (certifications.includes('TET') || certifications.includes('STET')) score += 40;
  if (certifications.includes('CTET')) score += 40;
  if (certifications.includes('NET') || certifications.includes('SET')) score += 20;
  return Math.min(score, 100);
}

function calculateSkillsScore(skills: string[]): number {
  const score = skills.length * 10;
  return Math.min(score, 100);
}

function generateStrengths(education: string[], certifications: string[], skills: string[]): string[] {
  const strengths: string[] = [];
  
  if (education.some(e => e.includes('B.ED') || e.includes('M.ED'))) {
    strengths.push('Strong educational foundation in teaching');
  }
  
  if (certifications.length > 0) {
    strengths.push(`Certified teacher with ${certifications.join(', ')}`);
  }
  
  if (skills.length > 5) {
    strengths.push('Diverse skill set for modern teaching');
  }
  
  if (strengths.length === 0) {
    strengths.push('Potential for growth in teaching career');
  }
  
  return strengths.slice(0, 5);
}

function generateImprovements(education: string[], certifications: string[], experienceYears: number): string[] {
  const improvements: string[] = [];
  
  if (!education.some(e => e.includes('B.ED') || e.includes('D.EL.ED'))) {
    improvements.push('Consider obtaining B.Ed qualification');
  }
  
  if (certifications.length === 0) {
    improvements.push('Pursue TET/CTET certification');
  }
  
  if (experienceYears < 2) {
    improvements.push('Gain more teaching experience');
  }
  
  if (improvements.length === 0) {
    improvements.push('Keep updating with latest teaching methodologies');
  }
  
  return improvements.slice(0, 3);
}

// Export cache clear function for testing purposes
export function clearAnalysisCache() {
  analysisCache.clear();
}