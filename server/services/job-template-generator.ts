import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InsertJobListing } from '@shared/schema';
import { IStorage } from '../storage';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Assam districts for location standardization
const ASSAM_DISTRICTS = [
  'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar', 'Charaideo', 'Chirang', 
  'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Golaghat', 
  'Guwahati', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan', 
  'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 
  'Nagaon', 'Nalbari', 'Sivasagar', 'Sonitpur', 'South Salmara-Mankachar', 
  'Tinsukia', 'Udalguri', 'West Karbi Anglong'
];

// Common keywords for tag generation
const TAG_KEYWORDS = {
  qualifications: ['TET', 'CTET', 'ATET', 'B.Ed', 'D.El.Ed', 'M.Ed', 'NET', 'SLET', 'PhD'],
  levels: ['Primary', 'Upper Primary', 'Secondary', 'Higher Secondary', 'College', 'University'],
  subjects: ['Mathematics', 'Science', 'English', 'Hindi', 'Assamese', 'Social Studies', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics'],
  jobTypes: ['Government Job', 'Private School', 'Central Government', 'Defence', 'Contract', 'Guest Faculty', 'Part-time'],
  benefits: ['Accommodation', 'Transport', 'Medical', 'PF', 'Gratuity', 'Pension'],
  special: ['Mass Recruitment', 'Walk-in Interview', 'Direct Recruitment', 'Contractual', 'Regular', 'Permanent']
};

// Category mapping based on organization and content
const CATEGORY_PATTERNS = {
  'Government': ['dee', 'dse', 'dme', 'dthe', 'apsc', 'ssa', 'government', 'govt', 'state'],
  'Central Government': ['kvs', 'nvs', 'jnv', 'kendriya', 'navodaya', 'central', 'ugc', 'aicte', 'ncert'],
  'Private': ['private', 'pvt', 'international school', 'convent', 'public school', 'academy'],
  'Defence': ['sainik', 'military', 'army', 'navy', 'air force', 'ncc', 'defence'],
  'University': ['university', 'college', 'institute', 'iit', 'nit', 'iiit', 'polytechnic', 'engineering']
};

interface RawJobData {
  title?: string;
  organization?: string;
  location?: string;
  description?: string;
  requirements?: string;
  salary?: string;
  deadline?: string;
  jobType?: string;
  category?: string;
  tags?: string[];
  source?: string;
  sourceUrl?: string;
  applicationLink?: string;
  [key: string]: any;
}

export class JobTemplateGenerator {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Main method to format raw job data into standardized JobListing format
   */
  async formatJobListing(rawData: RawJobData): Promise<InsertJobListing> {
    // Start with basic formatting
    let formattedJob: InsertJobListing = {
      title: this.formatJobTitle(rawData.title || 'Teaching Position'),
      organization: this.formatOrganization(rawData.organization || 'Educational Institution'),
      location: await this.standardizeLocation(rawData.location || 'Assam'),
      description: this.formatDescription(rawData.description || ''),
      requirements: this.formatRequirements(rawData.requirements || ''),
      salary: this.parseSalaryRange(rawData.salary || ''),
      applicationDeadline: this.parseDeadline(rawData.deadline || rawData.applicationDeadline || ''),
      jobType: this.normalizeJobType(rawData.jobType || 'full-time'),
      category: await this.inferCategory(rawData),
      tags: await this.generateTags(rawData),
      source: rawData.source || 'Web Scraper',
      sourceUrl: rawData.sourceUrl || '',
      applicationLink: rawData.applicationLink || '',
      isActive: true,
      externalId: this.generateExternalId(rawData),
      aiSummary: null
    };

    // Enrich with AI if needed
    if (this.needsEnrichment(formattedJob)) {
      formattedJob = await this.enrichWithAI(formattedJob);
    }

    return formattedJob;
  }

  /**
   * Enrich job data using AI (GPT/Gemini)
   */
  async enrichWithAI(job: InsertJobListing): Promise<InsertJobListing> {
    try {
      // Try GPT first, fallback to Gemini
      const enriched = await this.enrichWithGPT(job).catch(async (error) => {
        console.error('GPT enrichment failed:', error);
        return await this.enrichWithGemini(job);
      });

      return enriched;
    } catch (error) {
      console.error('AI enrichment failed:', error);
      return job;
    }
  }

  /**
   * Enrich job with OpenAI GPT
   */
  private async enrichWithGPT(job: InsertJobListing): Promise<InsertJobListing> {
    const prompt = `Enhance this teaching job listing for Assam, India. Fill in missing information based on context:

Title: ${job.title}
Organization: ${job.organization}
Location: ${job.location}
Description: ${job.description?.substring(0, 500)}
Requirements: ${job.requirements?.substring(0, 300)}
Salary: ${job.salary}

Please provide:
1. Enhanced professional job title (if current is vague)
2. Comprehensive job description (3-4 paragraphs) if current is too short
3. Detailed requirements in bullet points
4. Salary range in format "₹XX,XXX - ₹XX,XXX" if missing
5. AI summary highlighting key benefits (2-3 sentences)
6. Additional relevant tags

Return as JSON with fields: title, description, requirements, salary, aiSummary, additionalTags`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a job listing specialist for teaching positions in Assam, India. Enhance job listings to be professional, comprehensive, and appealing to qualified teachers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const enrichedData = JSON.parse(content);
      
      return {
        ...job,
        title: enrichedData.title || job.title,
        description: enrichedData.description || job.description,
        requirements: enrichedData.requirements || job.requirements,
        salary: enrichedData.salary || job.salary,
        aiSummary: enrichedData.aiSummary || await this.generateAISummary(job),
        tags: [...(job.tags || []), ...(enrichedData.additionalTags || [])]
      };
    }

    return job;
  }

  /**
   * Enrich job with Google Gemini
   */
  private async enrichWithGemini(job: InsertJobListing): Promise<InsertJobListing> {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `Enhance this teaching job listing for Assam, India:

Title: ${job.title}
Organization: ${job.organization}
Current Description: ${job.description?.substring(0, 500)}

Create:
1. Professional job title
2. Detailed 3-4 paragraph description
3. Requirements in bullet format
4. Salary in ₹XX,XXX - ₹XX,XXX format
5. 2-3 sentence summary of key benefits

Format as JSON with: title, description, requirements, salary, aiSummary`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const enrichedData = JSON.parse(jsonMatch[0]);
      
      return {
        ...job,
        title: enrichedData.title || job.title,
        description: enrichedData.description || job.description,
        requirements: enrichedData.requirements || job.requirements,
        salary: enrichedData.salary || job.salary,
        aiSummary: enrichedData.aiSummary || await this.generateAISummary(job)
      };
    }

    return job;
  }

  /**
   * Generate relevant tags based on job content
   */
  async generateTags(data: RawJobData): Promise<string[]> {
    const tags = new Set<string>();
    
    // Combine all text content for analysis
    const content = `${data.title} ${data.organization} ${data.description} ${data.requirements}`.toLowerCase();
    
    // Check for qualification tags
    for (const qual of TAG_KEYWORDS.qualifications) {
      if (content.includes(qual.toLowerCase())) {
        tags.add(qual);
        if (qual === 'TET' || qual === 'CTET' || qual === 'ATET') {
          tags.add('TET Required');
        }
      }
    }
    
    // Check for level tags
    for (const level of TAG_KEYWORDS.levels) {
      if (content.includes(level.toLowerCase())) {
        tags.add(level);
      }
    }
    
    // Check for subject tags
    for (const subject of TAG_KEYWORDS.subjects) {
      if (content.includes(subject.toLowerCase())) {
        tags.add(subject);
      }
    }
    
    // Check for job type tags
    for (const type of TAG_KEYWORDS.jobTypes) {
      if (content.includes(type.toLowerCase())) {
        tags.add(type);
      }
    }
    
    // Check for special tags
    if (content.includes('walk-in') || content.includes('walkin')) {
      tags.add('Walk-in Interview');
    }
    
    if (content.match(/\d{3,}\s*posts?/i)) {
      tags.add('Mass Recruitment');
    }
    
    if (content.includes('contract')) {
      tags.add('Contractual');
    }
    
    if (content.includes('regular') || content.includes('permanent')) {
      tags.add('Permanent');
    }

    // Add existing tags if any
    if (data.tags && Array.isArray(data.tags)) {
      data.tags.forEach(tag => tags.add(tag));
    }
    
    return Array.from(tags);
  }

  /**
   * Infer job category based on organization and content
   */
  async inferCategory(data: RawJobData): Promise<string> {
    const content = `${data.organization} ${data.title} ${data.description}`.toLowerCase();
    
    // Check category patterns
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          return category;
        }
      }
    }
    
    // Default based on specific keywords
    if (content.includes('school')) {
      return content.includes('private') ? 'Private' : 'Government';
    }
    
    if (content.includes('college') || content.includes('university')) {
      return 'University';
    }
    
    return data.category || 'Government'; // Default to Government for Assam jobs
  }

  /**
   * Standardize location names for Assam districts
   */
  async standardizeLocation(location: string): Promise<string> {
    if (!location) return 'Assam';
    
    const locationLower = location.toLowerCase();
    
    // Check for "All Districts" or similar
    if (locationLower.includes('all district') || locationLower.includes('various district')) {
      return 'Various Districts, Assam';
    }
    
    // Check for specific Assam districts
    for (const district of ASSAM_DISTRICTS) {
      if (locationLower.includes(district.toLowerCase())) {
        return `${district}, Assam`;
      }
    }
    
    // Check for common city names
    const cities = ['Guwahati', 'Jorhat', 'Dibrugarh', 'Tezpur', 'Silchar', 'Tinsukia', 'Nagaon'];
    for (const city of cities) {
      if (locationLower.includes(city.toLowerCase())) {
        return `${city}, Assam`;
      }
    }
    
    // If Assam is mentioned, format properly
    if (locationLower.includes('assam')) {
      // Extract district/city name if present
      const parts = location.split(/[,\-]/);
      if (parts.length > 1) {
        return `${parts[0].trim()}, Assam`;
      }
      return 'Assam';
    }
    
    // Default: append Assam if not present
    return location.includes('Assam') ? location : `${location}, Assam`;
  }

  /**
   * Parse and format salary range
   */
  parseSalaryRange(salary: string): string {
    if (!salary || salary === 'Not specified') {
      return 'As per government norms';
    }
    
    // Check if already in correct format
    if (salary.match(/₹[\d,]+\s*-\s*₹[\d,]+/)) {
      return salary;
    }
    
    // Extract numbers from salary string
    const numbers = salary.match(/\d+[\d,]*/g);
    if (numbers && numbers.length >= 2) {
      const min = parseInt(numbers[0].replace(/,/g, ''));
      const max = parseInt(numbers[1].replace(/,/g, ''));
      
      // Format with Indian comma notation
      const formatIndian = (num: number) => {
        return num.toLocaleString('en-IN');
      };
      
      return `₹${formatIndian(min)} - ₹${formatIndian(max)}`;
    }
    
    // Check for pay band mentions
    if (salary.toLowerCase().includes('pay band') || salary.toLowerCase().includes('grade pay')) {
      // Try to extract pay band details
      const payBandMatch = salary.match(/pay\s*band[\s-]*(\d+)/i);
      const gradePay = salary.match(/grade\s*pay[\s:]*₹?([\d,]+)/i);
      
      if (payBandMatch) {
        const band = payBandMatch[1];
        if (band === '2') {
          return '₹14,000 - ₹70,000 (Pay Band-2) + Grade Pay';
        } else if (band === '3') {
          return '₹15,600 - ₹39,100 (Pay Band-3) + Grade Pay';
        }
      }
    }
    
    // Check for level mentions (7th Pay Commission)
    if (salary.toLowerCase().includes('level')) {
      const levelMatch = salary.match(/level[\s-]*(\d+)/i);
      if (levelMatch) {
        const level = parseInt(levelMatch[1]);
        // Common teacher pay levels
        if (level === 7) return '₹44,900 - ₹1,42,400';
        if (level === 8) return '₹47,600 - ₹1,51,100';
        if (level === 9) return '₹53,100 - ₹1,67,800';
        if (level === 10) return '₹56,100 - ₹1,77,500';
      }
    }
    
    // Return original if no pattern matches
    return salary;
  }

  /**
   * Parse and validate application deadline
   */
  parseDeadline(deadline: string | Date | null): Date | null {
    if (!deadline) return null;
    
    // If already a Date object
    if (deadline instanceof Date) {
      return deadline;
    }
    
    // Try to parse string date
    try {
      // Common date formats in job postings
      const dateStr = deadline.toString();
      
      // Check for DD/MM/YYYY or DD-MM-YYYY
      const ddmmyyyy = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (ddmmyyyy) {
        const [_, day, month, year] = ddmmyyyy;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // Check for Month DD, YYYY
      const monthDayYear = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (monthDayYear) {
        const [_, month, day, year] = monthDayYear;
        return new Date(`${month} ${day}, ${year}`);
      }
      
      // Check for YYYY-MM-DD
      const isoDate = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoDate) {
        return new Date(dateStr);
      }
      
      // Try direct parsing
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch (error) {
      console.error('Error parsing deadline:', error);
    }
    
    return null;
  }

  /**
   * Format job title to be professional and SEO-friendly
   */
  private formatJobTitle(title: string): string {
    // Remove extra spaces and normalize
    title = title.trim().replace(/\s+/g, ' ');
    
    // Capitalize properly
    title = title.replace(/\b\w+/g, (word) => {
      // Don't capitalize small words unless at start
      const smallWords = ['of', 'in', 'at', 'for', 'and', 'the', 'a', 'an'];
      if (smallWords.includes(word.toLowerCase()) && word !== title.split(' ')[0]) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
    
    // Add post count if present in original
    const postMatch = title.match(/\d+\s*posts?/i);
    if (postMatch && !title.includes('(')) {
      title = `${title.replace(postMatch[0], '').trim()} (${postMatch[0]})`;
    }
    
    // Ensure it mentions teacher/teaching if not already
    if (!title.toLowerCase().includes('teacher') && 
        !title.toLowerCase().includes('professor') && 
        !title.toLowerCase().includes('lecturer') &&
        !title.toLowerCase().includes('faculty')) {
      title = `${title} - Teaching Position`;
    }
    
    return title;
  }

  /**
   * Format organization name
   */
  private formatOrganization(org: string): string {
    // Expand common abbreviations
    const abbreviations: Record<string, string> = {
      'DEE': 'Directorate of Elementary Education',
      'DSE': 'Directorate of Secondary Education',
      'DME': 'Directorate of Medical Education',
      'DTHE': 'Directorate of Technical Education',
      'APSC': 'Assam Public Service Commission',
      'SSA': 'Sarva Shiksha Abhiyan',
      'KVS': 'Kendriya Vidyalaya Sangathan',
      'NVS': 'Navodaya Vidyalaya Samiti',
      'JNV': 'Jawahar Navodaya Vidyalaya'
    };
    
    // Check if org is just an abbreviation
    const orgUpper = org.toUpperCase();
    if (abbreviations[orgUpper]) {
      return `${abbreviations[orgUpper]} (${orgUpper}), Assam`;
    }
    
    // Add Assam if not present and it's a government org
    if (!org.toLowerCase().includes('assam') && 
        (org.toLowerCase().includes('directorate') || 
         org.toLowerCase().includes('department') ||
         org.toLowerCase().includes('commission'))) {
      return `${org}, Assam`;
    }
    
    return org;
  }

  /**
   * Format description to be comprehensive
   */
  private formatDescription(description: string): string {
    if (!description || description.length < 100) {
      return `This is a teaching position in Assam. The role involves educating students and contributing to their academic and personal development. Candidates will be responsible for curriculum delivery, student assessment, and maintaining classroom discipline. This position offers job security, professional growth opportunities, and the chance to make a meaningful impact on students' lives. Please refer to the official notification for detailed information about responsibilities, eligibility criteria, and application process.`;
    }
    
    // Clean up description
    description = description.trim();
    
    // Ensure it ends with proper punctuation
    if (!description.match(/[.!?]$/)) {
      description += '.';
    }
    
    return description;
  }

  /**
   * Format requirements into readable bullet points
   */
  private formatRequirements(requirements: string): string {
    if (!requirements) {
      return `• Bachelor's degree in relevant subject
• B.Ed or equivalent teaching qualification
• Must have qualified TET/CTET (as applicable)
• Age limit as per government norms
• Permanent resident of Assam preferred
• Good communication skills in English and Assamese`;
    }
    
    // If already formatted with bullets or line breaks, clean up
    if (requirements.includes('•') || requirements.includes('\n')) {
      return requirements;
    }
    
    // Split by common delimiters
    const items = requirements.split(/[;,]|\d+\./);
    
    // Format as bullet points
    const formatted = items
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => `• ${item}`)
      .join('\n');
    
    return formatted || requirements;
  }

  /**
   * Generate AI summary for the job
   */
  private async generateAISummary(job: InsertJobListing): Promise<string> {
    const { title, organization, location, salary } = job;
    
    // Generate a concise, appealing summary
    const summaries = [
      `Excellent opportunity for qualified teachers at ${organization}. ${salary ? `Attractive salary package of ${salary}.` : 'Competitive government pay scale.'} Great career growth prospects.`,
      `Join ${organization} as ${title}. ${location} location with job security and comprehensive benefits. Perfect for dedicated educators.`,
      `Teaching position at prestigious ${organization}. ${salary ? `Salary: ${salary}.` : 'Government pay scale with allowances.'} Make a difference in students' lives.`
    ];
    
    // Return a random summary or use AI if available
    return summaries[Math.floor(Math.random() * summaries.length)];
  }

  /**
   * Normalize job type to standard values
   */
  private normalizeJobType(jobType: string): string {
    const lower = jobType.toLowerCase();
    
    if (lower.includes('full') || lower.includes('regular') || lower.includes('permanent')) {
      return 'full-time';
    }
    
    if (lower.includes('part')) {
      return 'part-time';
    }
    
    if (lower.includes('contract') || lower.includes('temporary')) {
      return 'contract';
    }
    
    return 'full-time'; // Default
  }

  /**
   * Generate unique external ID for tracking
   */
  private generateExternalId(data: RawJobData): string {
    // If external ID exists, use it
    if (data.externalId) return data.externalId;
    
    // Generate based on org, title, and timestamp
    const org = (data.organization || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const title = (data.title || 'job').toLowerCase().replace(/\s+/g, '-').substring(0, 20);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    
    return `${org}-${title}-${timestamp}-${random}`;
  }

  /**
   * Check if job needs AI enrichment
   */
  private needsEnrichment(job: InsertJobListing): boolean {
    // Check if critical fields are missing or too short
    if (!job.description || job.description.length < 150) return true;
    if (!job.requirements || job.requirements.length < 50) return true;
    if (!job.aiSummary) return true;
    if (!job.salary || job.salary === 'Not specified') return true;
    if (!job.tags || job.tags.length < 3) return true;
    
    return false;
  }

  /**
   * Batch process multiple jobs
   */
  async processBatch(rawJobs: RawJobData[]): Promise<InsertJobListing[]> {
    console.log(`📦 Processing batch of ${rawJobs.length} jobs...`);
    
    const processedJobs: InsertJobListing[] = [];
    
    // Process in chunks to avoid overwhelming AI APIs
    const chunkSize = 5;
    for (let i = 0; i < rawJobs.length; i += chunkSize) {
      const chunk = rawJobs.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(job => 
        this.formatJobListing(job).catch(error => {
          console.error('Error processing job:', error);
          return null;
        })
      );
      
      const results = await Promise.all(chunkPromises);
      processedJobs.push(...results.filter(job => job !== null) as InsertJobListing[]);
      
      // Small delay between chunks
      if (i + chunkSize < rawJobs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Processed ${processedJobs.length} jobs successfully`);
    return processedJobs;
  }

  /**
   * Validate and fix job data
   */
  async validateJobData(job: InsertJobListing): Promise<InsertJobListing> {
    // Ensure all required fields are present
    const validated = { ...job };
    
    // Required fields validation
    if (!validated.title || validated.title.trim() === '') {
      validated.title = 'Teaching Position';
    }
    
    if (!validated.organization || validated.organization.trim() === '') {
      validated.organization = 'Educational Institution, Assam';
    }
    
    if (!validated.location || validated.location.trim() === '') {
      validated.location = 'Assam';
    }
    
    if (!validated.description || validated.description.trim() === '') {
      validated.description = this.formatDescription('');
    }
    
    // Ensure proper formats
    validated.salary = this.parseSalaryRange(validated.salary || '');
    validated.location = await this.standardizeLocation(validated.location);
    validated.jobType = this.normalizeJobType(validated.jobType || 'full-time');
    
    // Ensure arrays are initialized
    validated.tags = validated.tags || [];
    
    // Set defaults
    validated.isActive = validated.isActive !== false;
    validated.source = validated.source || 'Web Scraper';
    
    return validated;
  }
}

// Export a factory function for creating the generator
export function createJobTemplateGenerator(storage: IStorage): JobTemplateGenerator {
  return new JobTemplateGenerator(storage);
}