import type { JobListing } from '@shared/schema';
import type { ResumeAnalysis } from './resume-analysis-service';

export interface JobMatchResult {
  jobId: number;
  matchScore: number; // 0-100
  matchReasons: string[];
  missingQualifications: string[];
  strengths: string[];
  recommendationLevel: 'perfect' | 'strong' | 'moderate' | 'stretch';
}

// Weights for different matching components
const MATCHING_WEIGHTS = {
  skills: 0.40,
  education: 0.30,
  experience: 0.20,
  location: 0.10
};

// Cache for storing match results
const matchCache = new Map<string, { matches: JobMatchResult[]; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Generate cache key for a resume and job set
function generateCacheKey(resumeId: string, jobCount: number): string {
  return `${resumeId}_${jobCount}`;
}

// Calculate skills match score with semantic similarity
function calculateSkillMatch(resumeSkills: string[], jobDescription: string, jobTitle: string): number {
  if (!resumeSkills || resumeSkills.length === 0) return 0;
  
  const normalizedResume = resumeSkills.map(s => s.toLowerCase().trim());
  const jobText = `${jobTitle} ${jobDescription}`.toLowerCase();
  
  // Common skill synonyms and related terms for teaching
  const skillSynonyms: { [key: string]: string[] } = {
    'mathematics': ['math', 'algebra', 'geometry', 'calculus', 'arithmetic', 'numerical'],
    'science': ['physics', 'chemistry', 'biology', 'environmental science', 'laboratory'],
    'english': ['language arts', 'literature', 'writing', 'grammar', 'composition'],
    'computer': ['it', 'information technology', 'programming', 'coding', 'software'],
    'teaching': ['education', 'instruction', 'pedagogy', 'classroom management', 'curriculum'],
    'communication': ['interpersonal', 'presentation', 'public speaking', 'verbal'],
    'leadership': ['management', 'coordination', 'team building', 'mentoring']
  };
  
  let matchedSkills = 0;
  let totalRelevantSkills = 0;
  
  for (const skill of normalizedResume) {
    let isMatched = false;
    
    // Direct match
    if (jobText.includes(skill)) {
      isMatched = true;
    }
    
    // Check synonyms
    if (!isMatched) {
      for (const [key, synonyms] of Object.entries(skillSynonyms)) {
        if (skill.includes(key) || key.includes(skill)) {
          if (synonyms.some(syn => jobText.includes(syn))) {
            isMatched = true;
            break;
          }
        }
        if (synonyms.includes(skill)) {
          if (jobText.includes(key) || synonyms.some(syn => jobText.includes(syn))) {
            isMatched = true;
            break;
          }
        }
      }
    }
    
    // Partial match for compound skills
    if (!isMatched) {
      const skillWords = skill.split(/\s+/);
      if (skillWords.length > 1 && skillWords.some(word => jobText.includes(word))) {
        isMatched = true;
        matchedSkills += 0.5; // Partial credit for partial matches
        totalRelevantSkills++;
        continue;
      }
    }
    
    if (isMatched) {
      matchedSkills++;
    }
    totalRelevantSkills++;
  }
  
  if (totalRelevantSkills === 0) return 0;
  return Math.min(100, (matchedSkills / totalRelevantSkills) * 100 * 1.2); // Boost by 20% but cap at 100
}

// Calculate education match score
function calculateEducationMatch(resumeEducation: string[], resumeCerts: string[], jobDescription: string, jobTitle: string): number {
  if (!resumeEducation && !resumeCerts) return 0;
  
  const allQualifications = [
    ...(resumeEducation || []),
    ...(resumeCerts || [])
  ].map(q => q.toLowerCase());
  
  const jobText = `${jobTitle} ${jobDescription}`.toLowerCase();
  
  // Key educational qualifications for teaching
  const essentialQualifications = {
    'b.ed': 100,
    'bachelor of education': 100,
    'm.ed': 90,
    'master of education': 90,
    'd.el.ed': 85,
    'tet': 95,
    'ctet': 95,
    'htet': 90,
    'net': 85,
    'set': 85,
    'phd': 80,
    'doctorate': 80,
    'b.a': 70,
    'b.sc': 70,
    'm.a': 75,
    'm.sc': 75
  };
  
  let maxScore = 0;
  let hasTeachingQualification = false;
  
  // Check for essential teaching qualifications
  for (const [qual, score] of Object.entries(essentialQualifications)) {
    if (allQualifications.some(q => q.includes(qual))) {
      maxScore = Math.max(maxScore, score);
      if (['b.ed', 'bachelor of education', 'm.ed', 'master of education', 'd.el.ed'].includes(qual)) {
        hasTeachingQualification = true;
      }
    }
    // Check if job specifically requires this qualification
    if (jobText.includes(qual)) {
      if (allQualifications.some(q => q.includes(qual))) {
        maxScore = Math.min(100, maxScore + 10); // Bonus for exact match
      } else {
        maxScore = Math.max(0, maxScore - 20); // Penalty for missing required qualification
      }
    }
  }
  
  // Special handling for TET/CTET - very important for government teaching jobs
  const hasTET = allQualifications.some(q => 
    q.includes('tet') || q.includes('teacher eligibility') || q.includes('ctet')
  );
  
  if ((jobText.includes('government') || jobText.includes('kvs') || jobText.includes('nvs')) && hasTET) {
    maxScore = Math.min(100, maxScore + 15);
  }
  
  // Bonus for teaching qualification
  if (hasTeachingQualification) {
    maxScore = Math.min(100, maxScore + 5);
  }
  
  return maxScore;
}

// Calculate experience match score
function calculateExperienceMatch(resumeExperience: string, jobDescription: string): number {
  if (!resumeExperience) return 30; // Base score for any candidate
  
  const jobText = jobDescription.toLowerCase();
  
  // Extract years of experience from resume
  const expPattern = /(\d+)\s*(years?|yrs?)/i;
  const resumeMatch = resumeExperience.match(expPattern);
  const resumeYears = resumeMatch ? parseInt(resumeMatch[1]) : 0;
  
  // Extract required experience from job
  const jobMatch = jobText.match(expPattern);
  const requiredYears = jobMatch ? parseInt(jobMatch[1]) : 0;
  
  // If job doesn't specify experience, give good score based on candidate's experience
  if (requiredYears === 0) {
    if (resumeYears === 0) return 60;
    if (resumeYears <= 2) return 80;
    if (resumeYears <= 5) return 90;
    return 100;
  }
  
  // Calculate match based on requirement
  const difference = Math.abs(resumeYears - requiredYears);
  
  if (resumeYears >= requiredYears) {
    // Candidate meets or exceeds requirement
    if (difference === 0) return 100;
    if (difference <= 2) return 90;
    if (difference <= 5) return 80;
    return 70; // Over-qualified but still good
  } else {
    // Candidate has less experience than required
    if (difference === 1) return 75;
    if (difference === 2) return 60;
    if (difference === 3) return 45;
    return 30; // Significantly under-qualified
  }
}

// Calculate location match score
function calculateLocationMatch(userLocation: string | undefined, jobLocation: string): number {
  if (!userLocation || !jobLocation) return 50; // Neutral score if location not specified
  
  const normalizedUser = userLocation.toLowerCase().trim();
  const normalizedJob = jobLocation.toLowerCase().trim();
  
  // Exact match
  if (normalizedUser === normalizedJob) return 100;
  
  // Same city/district
  if (normalizedUser.includes(normalizedJob) || normalizedJob.includes(normalizedUser)) {
    return 90;
  }
  
  // Assam-specific location matching
  const assamCities = [
    'guwahati', 'dibrugarh', 'jorhat', 'tezpur', 'silchar', 'nagaon',
    'tinsukia', 'bongaigaon', 'goalpara', 'nalbari', 'kamrup', 'cachar',
    'lakhimpur', 'sonitpur', 'kokrajhar', 'dhemaji', 'golaghat'
  ];
  
  const userInAssam = assamCities.some(city => normalizedUser.includes(city));
  const jobInAssam = assamCities.some(city => normalizedJob.includes(city));
  
  // Both in Assam
  if (userInAssam && jobInAssam) return 70;
  
  // State-level match
  if (normalizedUser.includes('assam') && normalizedJob.includes('assam')) return 75;
  
  // Remote or flexible locations
  if (normalizedJob.includes('remote') || normalizedJob.includes('anywhere')) return 80;
  if (normalizedJob.includes('multiple') || normalizedJob.includes('various')) return 70;
  
  // Different locations
  return 30;
}

// Get recommendation level based on score
function getRecommendationLevel(score: number): 'perfect' | 'strong' | 'moderate' | 'stretch' {
  if (score >= 85) return 'perfect';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'stretch';
}

// Main matching function
export async function matchResumeToJobs(
  resumeAnalysis: ResumeAnalysis,
  jobs: JobListing[],
  userLocation?: string
): Promise<JobMatchResult[]> {
  // Check cache
  const cacheKey = generateCacheKey(resumeAnalysis.analysisTimestamp, jobs.length);
  const cached = matchCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Returning cached job matches');
    return cached.matches;
  }
  
  const matches: JobMatchResult[] = [];
  
  for (const job of jobs) {
    const matchReasons: string[] = [];
    const missingQualifications: string[] = [];
    const strengths: string[] = [];
    
    // Calculate individual component scores
    const skillScore = calculateSkillMatch(
      resumeAnalysis.extractedData.skills,
      job.description || '',
      job.title
    );
    
    const educationScore = calculateEducationMatch(
      resumeAnalysis.extractedData.education,
      resumeAnalysis.extractedData.certifications,
      job.description || '',
      job.title
    );
    
    const experienceScore = calculateExperienceMatch(
      resumeAnalysis.extractedData.experience,
      job.description || ''
    );
    
    const locationScore = calculateLocationMatch(userLocation, job.location);
    
    // Calculate weighted total score
    const totalScore = Math.round(
      skillScore * MATCHING_WEIGHTS.skills +
      educationScore * MATCHING_WEIGHTS.education +
      experienceScore * MATCHING_WEIGHTS.experience +
      locationScore * MATCHING_WEIGHTS.location
    );
    
    // Generate match insights
    if (skillScore >= 70) {
      strengths.push('Strong skill alignment with job requirements');
    } else if (skillScore < 50) {
      missingQualifications.push('Limited matching skills for this position');
    }
    
    if (educationScore >= 80) {
      strengths.push('Excellent educational qualifications');
      if (resumeAnalysis.extractedData.certifications.some(c => 
        c.toLowerCase().includes('tet') || c.toLowerCase().includes('ctet')
      )) {
        strengths.push('TET/CTET certification is a major advantage');
      }
    } else if (educationScore < 60) {
      missingQualifications.push('May need additional teaching certifications');
    }
    
    if (experienceScore >= 80) {
      strengths.push('Experience level matches requirements well');
    } else if (experienceScore < 50) {
      missingQualifications.push('Experience level below preferred range');
    }
    
    if (locationScore >= 80) {
      matchReasons.push('Location is convenient');
    } else if (locationScore < 50) {
      matchReasons.push('Location may require relocation');
    }
    
    // Overall match reasons
    if (totalScore >= 70) {
      matchReasons.push(`${totalScore}% overall match based on your profile`);
    }
    
    // Special matching for government jobs
    if (job.category?.toLowerCase().includes('government') || 
        job.organization?.toLowerCase().includes('kendriya') ||
        job.organization?.toLowerCase().includes('navodaya')) {
      if (resumeAnalysis.extractedData.certifications.some(c => 
        c.toLowerCase().includes('tet') || c.toLowerCase().includes('ctet')
      )) {
        matchReasons.push('TET/CTET qualification perfect for government teaching roles');
      }
    }
    
    matches.push({
      jobId: job.id,
      matchScore: totalScore,
      matchReasons,
      missingQualifications,
      strengths,
      recommendationLevel: getRecommendationLevel(totalScore)
    });
  }
  
  // Sort by match score (highest first)
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  // Cache the results
  matchCache.set(cacheKey, {
    matches,
    timestamp: Date.now()
  });
  
  return matches;
}

// Clear cache (useful for testing or manual refresh)
export function clearMatchCache(): void {
  matchCache.clear();
}