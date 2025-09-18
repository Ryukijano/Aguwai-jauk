import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { IStorage } from '../storage';
import { InsertJobListing } from '@shared/schema';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Search queries for finding teacher jobs in Assam
const SEARCH_QUERIES = [
  'teacher jobs in Assam government schools 2024 2025',
  'Assam teacher recruitment latest notifications',
  'TET qualified teacher vacancies Assam',
  'primary secondary teacher posts Assam education department',
  'APSC teaching positions recruitment Assam',
  'SSA Assam teacher recruitment latest',
  'DEE Assam teacher job openings',
  'Assam college lecturer professor recruitment',
  'private school teacher jobs Guwahati Jorhat Dibrugarh',
  'KVS NVS teacher recruitment Assam region',
];

// Known job portals and government websites for Assam
const JOB_SOURCES = [
  'https://apsc.nic.in',
  'https://ssa.assam.gov.in',
  'https://dee.assam.gov.in',
  'https://sebaonline.org',
  'https://www.assamcareer.com',
  'https://assamjobz.com',
  'https://www.govtjobsassam.com',
  'https://www.sarkariresult.com/assam',
];

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export class AIJobScraperService {
  private storage: IStorage;
  private processedUrls: Set<string> = new Set();
  private rateLimitDelay = 1000; // 1 second between API calls
  
  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Main method to search and scrape jobs using both AI providers
   */
  async scrapeJobsWithAI(): Promise<InsertJobListing[]> {
    console.log('🤖 Starting AI-powered job scraping...');
    const allJobs: InsertJobListing[] = [];
    
    try {
      // Search with both GPT and Gemini
      const [gptJobs, geminiJobs] = await Promise.all([
        this.searchJobsWithGPT().catch(err => {
          console.error('Error with GPT search:', err);
          return [];
        }),
        this.searchJobsWithGemini().catch(err => {
          console.error('Error with Gemini search:', err);
          return [];
        })
      ]);
      
      allJobs.push(...gptJobs, ...geminiJobs);
      
      // Deduplicate and validate jobs
      const uniqueJobs = this.deduplicateJobs(allJobs);
      const validatedJobs = await this.validateAndEnrichJobs(uniqueJobs);
      
      // Store jobs in database
      await this.storeJobs(validatedJobs);
      
      console.log(`✅ AI scraping complete. Found ${validatedJobs.length} unique teaching jobs`);
      return validatedJobs;
      
    } catch (error) {
      console.error('Error in AI job scraping:', error);
      return allJobs;
    }
  }

  /**
   * Search for jobs using OpenAI GPT
   */
  async searchJobsWithGPT(): Promise<InsertJobListing[]> {
    console.log('🔍 Searching jobs with OpenAI GPT...');
    const jobs: InsertJobListing[] = [];
    
    try {
      for (const query of SEARCH_QUERIES.slice(0, 3)) { // Limit queries to control costs
        await this.delay(this.rateLimitDelay);
        
        // Use GPT to generate search results and extract job information
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a job search assistant specializing in finding teacher positions in Assam, India. 
                       Extract structured job information from search results and web content.
                       Focus on government schools, colleges, and educational institutions in Assam.
                       Return data in JSON format with fields: title, organization, location, description, 
                       requirements, salary, applicationDeadline, jobType, category, applicationLink.`
            },
            {
              role: 'user',
              content: `Search for: "${query}". Find current teacher job openings in Assam.
                       Consider positions from: APSC, SSA Assam, DEE Assam, KVS, NVS, state schools, colleges.
                       Extract 3-5 relevant job listings with complete details. Return as JSON array.`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 2000
        });
        
        const content = response.choices[0]?.message?.content;
        if (content) {
          try {
            const parsed = JSON.parse(content);
            const jobListings = parsed.jobs || parsed.listings || [];
            
            for (const job of jobListings) {
              const formattedJob = await this.extractJobFromContent({
                title: job.title || '',
                content: JSON.stringify(job),
                url: job.applicationLink || '',
                source: 'OpenAI GPT Search'
              });
              
              if (formattedJob) {
                jobs.push(formattedJob);
              }
            }
          } catch (parseError) {
            console.error('Error parsing GPT response:', parseError);
          }
        }
      }
      
      // Additionally, scrape specific URLs using GPT for extraction
      for (const sourceUrl of JOB_SOURCES.slice(0, 2)) {
        const scrapedJobs = await this.scrapeUrlWithGPT(sourceUrl);
        jobs.push(...scrapedJobs);
      }
      
    } catch (error) {
      console.error('Error in GPT job search:', error);
    }
    
    return jobs;
  }

  /**
   * Search for jobs using Google Gemini
   */
  async searchJobsWithGemini(): Promise<InsertJobListing[]> {
    console.log('🔍 Searching and extracting real jobs with Google Gemini...');
    const jobs: InsertJobListing[] = [];
    
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      // Search for real jobs and use Gemini to extract information
      for (const query of SEARCH_QUERIES.slice(2, 4)) { // Different queries than GPT
        const searchResults = await webSearchService.searchForJobs(query, 3);
        
        // Use Gemini to enrich and structure the real search results
        for (const result of searchResults) {
          if (result) {
            const enrichedJob = await this.enrichJobWithGemini(this.convertPartialToFullJob(result));
            if (enrichedJob) {
              jobs.push(enrichedJob);
            }
          }
        }
      }
      
      // Additionally, fetch aggregator sites and extract jobs
      const aggregatorUrls = [
        'https://assamjobz.com/category/teaching-jobs/',
        'https://dee.assam.gov.in/portlets/recruitment',
        'https://www.sarkariresult.com/assam/'
      ];
      
      for (const url of aggregatorUrls) {
        const pageContent = await webSearchService.fetchWebPage(url);
        if (pageContent) {
          const extractedJobs = await this.extractJobsFromPageWithGemini(pageContent);
          jobs.push(...extractedJobs);
        }
      }
      
    } catch (error) {
      console.error('Error in Gemini job search:', error);
    }
    
    return jobs;
  }

  /**
   * Scrape a specific URL using GPT for extraction
   */
  private async extractJobsFromPageWithGemini(pageContent: any): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    try {
      if (!pageContent || !pageContent.text) return jobs;
      
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `Extract teaching job listings from this webpage content.
                     Focus on teacher positions in Assam, India.
                     
                     URL: ${pageContent.url}
                     Page Title: ${pageContent.title}
                     Content: ${pageContent.text.substring(0, 4000)}
                     
                     For each job found, extract:
                     - title: job title
                     - organization: employer name
                     - location: job location in Assam
                     - description: job details
                     - requirements: eligibility criteria
                     - salary: salary information
                     - deadline: application deadline
                     - type: job type (full-time/part-time/contract)
                     - link: application link if available
                     
                     Return as JSON array with extracted jobs.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const listings = JSON.parse(jsonMatch[0]);
        
        for (const job of listings) {
          const formattedJob = await this.extractJobFromContent({
            title: job.title || '',
            content: JSON.stringify(job),
            url: pageContent.url,
            source: `Web - ${new URL(pageContent.url).hostname}`
          });
          
          if (formattedJob) {
            jobs.push(formattedJob);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting jobs with Gemini:', error);
    }
    
    return jobs;
  }

  private async scrapeUrlWithGPT(url: string): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    try {
      if (this.processedUrls.has(url)) return jobs;
      this.processedUrls.add(url);
      
      // Fetch the webpage
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      // Get text content (limit to avoid token limits)
      const pageText = $('body').text().slice(0, 5000);
      
      // Use GPT to extract job information
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract teacher job listings from the webpage content. Focus on positions in Assam.'
          },
          {
            role: 'user',
            content: `Extract teaching job listings from this webpage content:\n\n${pageText}\n\nReturn as JSON array with job details.`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500
      });
      
      const content = gptResponse.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const listings = parsed.jobs || parsed.listings || [];
        
        for (const job of listings) {
          const formattedJob = await this.extractJobFromContent({
            title: job.title || '',
            content: JSON.stringify(job),
            url: url,
            source: `GPT - ${new URL(url).hostname}`
          });
          
          if (formattedJob) {
            jobs.push(formattedJob);
          }
        }
      }
    } catch (error) {
      console.error(`Error scraping ${url} with GPT:`, error);
    }
    
    return jobs;
  }

  /**
   * Scrape a specific URL using Gemini for extraction
   */
  private async scrapeUrlWithGemini(url: string): Promise<InsertJobListing[]> {
    // This method can be removed as we're now using the web search service
    return [];
  }

  /**
   * Convert partial job listing to full job listing
   */
  private convertPartialToFullJob(partial: Partial<InsertJobListing>): InsertJobListing {
    return {
      title: partial.title || 'Teaching Position',
      organization: partial.organization || 'Educational Institution',
      location: partial.location || 'Assam, India',
      description: partial.description || 'Teaching position in Assam. Check official notification for details.',
      requirements: partial.requirements || 'As per official notification',
      salary: partial.salary || 'As per government norms',
      applicationDeadline: partial.applicationDeadline || null,
      jobType: partial.jobType || 'full-time',
      category: partial.category || 'Teaching',
      tags: partial.tags || [],
      source: partial.source || 'Web',
      sourceUrl: partial.sourceUrl || '',
      applicationLink: partial.applicationLink || '',
      isActive: partial.isActive !== undefined ? partial.isActive : true,
      externalId: partial.externalId || `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      aiSummary: partial.aiSummary || null
    };
  }

  /**
   * Enrich job listing with GPT analysis
   */
  private async enrichJobWithGPT(job: InsertJobListing): Promise<InsertJobListing> {
    try {
      const prompt = `Analyze and enrich this teaching job listing with missing information:
                     Title: ${job.title}
                     Organization: ${job.organization}
                     Location: ${job.location}
                     Description: ${job.description?.substring(0, 500)}
                     
                     Provide enriched data including:
                     - Better formatted description
                     - Inferred requirements if missing
                     - Estimated salary range if not specified
                     - Proper categorization
                     - Relevant tags
                     
                     Return as JSON with enriched fields.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a job listing analyst. Enrich job data with relevant information based on context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const enrichedData = JSON.parse(content);
        
        // Merge enriched data with original job
        return {
          ...job,
          description: enrichedData.description || job.description,
          requirements: enrichedData.requirements || job.requirements,
          salary: enrichedData.salary || job.salary,
          category: enrichedData.category || job.category,
          tags: enrichedData.tags || job.tags,
          aiSummary: enrichedData.summary || await this.generateAISummary(job)
        };
      }
    } catch (error) {
      console.error('Error enriching job with GPT:', error);
    }
    
    return job;
  }

  /**
   * Enrich job listing with Gemini analysis
   */
  private async enrichJobWithGemini(job: InsertJobListing): Promise<InsertJobListing> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `Analyze and enrich this teaching job listing:
                     Title: ${job.title}
                     Organization: ${job.organization}
                     Location: ${job.location}
                     Current Description: ${job.description?.substring(0, 500)}
                     
                     Provide enriched information:
                     - Enhanced description
                     - Detailed requirements (if missing)
                     - Salary estimation (if not provided)
                     - Proper job category
                     - Relevant tags for searchability
                     
                     Format as JSON with enriched fields.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enrichedData = JSON.parse(jsonMatch[0]);
        
        // Merge enriched data with original job
        return {
          ...job,
          description: enrichedData.description || job.description,
          requirements: enrichedData.requirements || job.requirements,
          salary: enrichedData.salary || job.salary,
          category: enrichedData.category || job.category,
          tags: enrichedData.tags || job.tags,
          aiSummary: enrichedData.summary || await this.generateAISummary(job)
        };
      }
    } catch (error) {
      console.error('Error enriching job with Gemini:', error);
    }
    
    return job;
  }

  /**
   * Extract structured job information from unstructured content
   */
  async extractJobFromContent(data: {
    title: string;
    content: string;
    url: string;
    source: string;
  }): Promise<InsertJobListing | null> {
    try {
      // Parse the content if it's JSON
      let jobData: any = {};
      
      if (data.content.startsWith('{') || data.content.startsWith('[')) {
        try {
          jobData = JSON.parse(data.content);
        } catch {
          jobData = { description: data.content };
        }
      } else {
        jobData = { description: data.content };
      }
      
      // Extract and validate fields
      const job: InsertJobListing = {
        title: jobData.title || data.title || 'Teaching Position',
        organization: this.extractOrganization(jobData, data.source),
        location: this.extractLocation(jobData),
        description: this.cleanDescription(jobData.description || jobData.content || data.content),
        requirements: this.extractRequirements(jobData),
        salary: this.extractSalary(jobData),
        applicationDeadline: this.extractDeadline(jobData) as any,
        jobType: this.extractJobType(jobData),
        category: this.extractCategory(jobData),
        tags: this.extractTags(jobData, data.title),
        source: data.source,
        sourceUrl: data.url,
        applicationLink: jobData.applicationLink || jobData.link || data.url,
        isActive: true,
        externalId: this.generateExternalId(data.title, data.source),
        aiSummary: null // Will be added in validateAndEnrichJob
      };
      
      // Validate it's a teaching job in Assam
      if (!this.isValidTeachingJob(job)) {
        return null;
      }
      
      return job;
      
    } catch (error) {
      console.error('Error extracting job from content:', error);
      return null;
    }
  }

  /**
   * Validate and enrich job data with AI summaries
   */
  async validateAndEnrichJob(job: InsertJobListing): Promise<InsertJobListing> {
    try {
      // Generate AI summary using GPT or Gemini
      if (!job.aiSummary) {
        job.aiSummary = await this.generateAISummary(job);
      }
      
      // Ensure all required fields are present
      if (!job.organization) {
        job.organization = 'Educational Institution, Assam';
      }
      
      if (!job.location || job.location === 'Assam, India') {
        job.location = this.inferLocation(job.title || '', job.description || '');
      }
      
      if (!job.requirements || job.requirements === 'As per official notification') {
        job.requirements = this.inferRequirements(job.title || '', job.category || 'Teaching');
      }
      
      if (!job.applicationDeadline) {
        // Set deadline to 30 days from now if not specified
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);
        job.applicationDeadline = deadline as any;
      }
      
      // Ensure category is set correctly
      if (!job.category || job.category === 'Teaching') {
        job.category = this.determineDetailedCategory(job.title || '', job.description || '');
      }
      
      // Add relevant tags if not present
      if (!job.tags || job.tags.length === 0) {
        job.tags = this.generateTags(job);
      }
      
      return job;
      
    } catch (error) {
      console.error('Error enriching job:', error);
      return job;
    }
  }

  /**
   * Batch validate and enrich multiple jobs
   */
  private async validateAndEnrichJobs(jobs: InsertJobListing[]): Promise<InsertJobListing[]> {
    const enrichedJobs: InsertJobListing[] = [];
    
    for (const job of jobs) {
      const enrichedJob = await this.validateAndEnrichJob(job);
      enrichedJobs.push(enrichedJob);
    }
    
    return enrichedJobs;
  }

  /**
   * Generate AI summary for a job listing
   */
  private async generateAISummary(job: InsertJobListing): Promise<string> {
    try {
      // Try GPT first, fallback to Gemini
      const prompt = `Create a concise 2-3 sentence summary of this teaching job:
                     Title: ${job.title}
                     Organization: ${job.organization}
                     Location: ${job.location}
                     Requirements: ${job.requirements}
                     Salary: ${job.salary}`;
      
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 150,
          temperature: 0.7
        });
        
        return response.choices[0]?.message?.content || this.generateDefaultSummary(job);
      } catch {
        // Fallback to Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        return result.response.text() || this.generateDefaultSummary(job as any);
      }
      
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return this.generateDefaultSummary(job);
    }
  }

  /**
   * Generate a default summary without AI
   */
  private generateDefaultSummary(job: any): string {
    const title = job.title || 'Teaching';
    const org = job.organization || 'Educational Institution';
    const loc = job.location || 'Assam';
    const jobType = job.jobType === 'full-time' ? 'Full-time' : 'Part-time';
    const deadline = job.applicationDeadline ? 
      ((job.applicationDeadline as any) instanceof Date ? 
        job.applicationDeadline.toLocaleDateString() : 
        typeof job.applicationDeadline === 'string' ? 
          new Date(job.applicationDeadline).toLocaleDateString() : 
          'Check official notification') : 
      'Check official notification';
    
    return `${title} position available at ${org} in ${loc}. ${jobType} opportunity in the education sector. Application deadline: ${deadline}.`;
  }

  // Helper methods for extraction and validation

  private extractOrganization(jobData: any, source: string): string {
    return jobData.organization || 
           jobData.company || 
           jobData.school || 
           jobData.institution || 
           this.inferOrganizationFromSource(source);
  }

  private inferOrganizationFromSource(source: string): string {
    if (source.includes('APSC')) return 'Assam Public Service Commission';
    if (source.includes('SSA')) return 'Sarva Shiksha Abhiyan, Assam';
    if (source.includes('DEE')) return 'Directorate of Elementary Education, Assam';
    if (source.includes('KVS')) return 'Kendriya Vidyalaya Sangathan';
    if (source.includes('NVS')) return 'Navodaya Vidyalaya Samiti';
    return 'Government of Assam - Education Department';
  }

  private extractLocation(jobData: any): string {
    const location = jobData.location || jobData.place || jobData.city || '';
    
    // Ensure it's in Assam
    if (location && !location.toLowerCase().includes('assam')) {
      return `${location}, Assam, India`;
    }
    
    return location || 'Assam, India';
  }

  private inferLocation(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();
    
    const cities = [
      'Guwahati', 'Jorhat', 'Dibrugarh', 'Tezpur', 'Silchar',
      'Nagaon', 'Tinsukia', 'Bongaigaon', 'Kokrajhar', 'Dhubri'
    ];
    
    for (const city of cities) {
      if (text.includes(city.toLowerCase())) {
        return `${city}, Assam, India`;
      }
    }
    
    return 'Assam, India';
  }

  private extractRequirements(jobData: any): string {
    const requirements = jobData.requirements || 
                        jobData.eligibility || 
                        jobData.qualifications || 
                        '';
    
    if (requirements) return this.cleanDescription(requirements);
    
    return 'Please refer to official notification for detailed eligibility criteria';
  }

  private inferRequirements(title: string, category: string): string {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('primary') || category === 'primary') {
      return 'Graduate with B.Ed/D.El.Ed, TET qualified preferred';
    }
    if (titleLower.includes('secondary') || category === 'secondary') {
      return 'Post Graduate in relevant subject with B.Ed, TET/CTET qualified';
    }
    if (titleLower.includes('professor') || titleLower.includes('lecturer')) {
      return 'Post Graduate/PhD in relevant subject with NET/SET qualification';
    }
    
    return 'Graduate/Post Graduate with B.Ed/M.Ed as per government norms';
  }

  private extractSalary(jobData: any): string {
    const salary = jobData.salary || jobData.pay || jobData.compensation || '';
    
    if (salary) return salary;
    
    // Try to extract from description
    const salaryPattern = /(?:salary|pay)[:\s]*([\d,]+)\s*(?:-|to)\s*([\d,]+)/i;
    const match = (jobData.description || '').match(salaryPattern);
    
    if (match) {
      return `₹${match[1]} - ₹${match[2]}`;
    }
    
    return 'As per government pay scale';
  }

  private extractDeadline(jobData: any): Date | null {
    const deadline = jobData.deadline || 
                    jobData.applicationDeadline || 
                    jobData.lastDate || 
                    jobData.closingDate;
    
    if (deadline) {
      const date = new Date(deadline);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    return null;
  }

  private extractJobType(jobData: any): string {
    const type = jobData.jobType || jobData.type || jobData.employmentType || '';
    
    if (type.toLowerCase().includes('part')) return 'part-time';
    if (type.toLowerCase().includes('contract')) return 'contract';
    if (type.toLowerCase().includes('temp')) return 'temporary';
    
    return 'full-time';
  }

  private extractCategory(jobData: any): string {
    const category = jobData.category || jobData.level || '';
    const title = (jobData.title || '').toLowerCase();
    
    if (category) return category;
    
    if (title.includes('primary')) return 'primary';
    if (title.includes('secondary') || title.includes('high school')) return 'secondary';
    if (title.includes('higher secondary') || title.includes('hs')) return 'higher-secondary';
    if (title.includes('college') || title.includes('lecturer')) return 'college';
    if (title.includes('university') || title.includes('professor')) return 'university';
    if (title.includes('special')) return 'special-education';
    
    return 'Teaching';
  }

  private determineDetailedCategory(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('primary') || text.includes('elementary')) return 'Primary Education';
    if (text.includes('middle school')) return 'Middle School';
    if (text.includes('high school') || text.includes('secondary')) return 'Secondary Education';
    if (text.includes('higher secondary') || text.includes('+2')) return 'Higher Secondary';
    if (text.includes('college')) return 'College Education';
    if (text.includes('university') || text.includes('professor')) return 'University Education';
    if (text.includes('special education') || text.includes('inclusive')) return 'Special Education';
    if (text.includes('vocational') || text.includes('technical')) return 'Vocational Education';
    
    return 'General Teaching';
  }

  private extractTags(jobData: any, title: string): string[] {
    const tags: string[] = jobData.tags || [];
    
    // Add subject-specific tags
    const subjects = ['english', 'mathematics', 'science', 'social studies', 'hindi', 
                     'assamese', 'physics', 'chemistry', 'biology', 'history', 'geography'];
    
    const text = (title + ' ' + (jobData.description || '')).toLowerCase();
    
    for (const subject of subjects) {
      if (text.includes(subject)) {
        tags.push(subject.charAt(0).toUpperCase() + subject.slice(1));
      }
    }
    
    // Add qualification tags
    if (text.includes('tet')) tags.push('TET');
    if (text.includes('ctet')) tags.push('CTET');
    if (text.includes('b.ed')) tags.push('B.Ed');
    if (text.includes('m.ed')) tags.push('M.Ed');
    if (text.includes('net')) tags.push('NET');
    if (text.includes('set')) tags.push('SET');
    
    const uniqueTags: string[] = [];
    const seen = new Set<string>();
    for (const tag of tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        uniqueTags.push(tag);
      }
    }
    return uniqueTags; // Remove duplicates
  }

  private generateTags(job: InsertJobListing): string[] {
    const tags: string[] = [];
    
    // Add location-based tags
    const location = job.location.toLowerCase();
    if (location.includes('guwahati')) tags.push('Guwahati');
    if (location.includes('jorhat')) tags.push('Jorhat');
    if (location.includes('dibrugarh')) tags.push('Dibrugarh');
    
    // Add category tags
    if (job.category) {
      tags.push(job.category);
    }
    
    // Add organization type tags
    const org = job.organization.toLowerCase();
    if (org.includes('government') || org.includes('govt')) tags.push('Government');
    if (org.includes('private')) tags.push('Private');
    if (org.includes('kvs') || org.includes('kendriya')) tags.push('Central Government');
    if (org.includes('nvs') || org.includes('navodaya')) tags.push('Central Government');
    
    // Add job type tags
    if (job.jobType === 'full-time') tags.push('Full Time');
    if (job.jobType === 'part-time') tags.push('Part Time');
    if (job.jobType === 'contract') tags.push('Contractual');
    
    const uniqueTags: string[] = [];
    const seen = new Set<string>();
    for (const tag of tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        uniqueTags.push(tag);
      }
    }
    return uniqueTags;
  }

  private cleanDescription(text: string): string {
    return text.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
      .substring(0, 1000);
  }

  private isValidTeachingJob(job: InsertJobListing): boolean {
    // Check if it's a teaching job
    const teachingKeywords = ['teacher', 'teaching', 'educator', 'professor', 'lecturer', 
                             'faculty', 'instructor', 'education', 'academic', 'school', 
                             'college', 'university', 'tet', 'b.ed', 'm.ed'];
    
    const jobText = (job.title + ' ' + job.description + ' ' + job.requirements).toLowerCase();
    const hasTeachingKeyword = teachingKeywords.some(keyword => jobText.includes(keyword));
    
    // Check if it's in Assam
    const isInAssam = job.location.toLowerCase().includes('assam');
    
    return hasTeachingKeyword && isInAssam;
  }

  private generateExternalId(title: string, source: string): string {
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanSource = source.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const timestamp = Date.now();
    
    return `${cleanSource}-${cleanTitle}-${timestamp}`;
  }

  private deduplicateJobs(jobs: InsertJobListing[]): InsertJobListing[] {
    const seen = new Map<string, InsertJobListing>();
    
    for (const job of jobs) {
      // Create a unique key based on title, organization, and location
      const key = `${job.title.toLowerCase()}-${job.organization.toLowerCase()}-${job.location.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, job);
      } else {
        // If duplicate found, keep the one with more information
        const existing = seen.get(key)!;
        if (job.description.length > existing.description.length) {
          seen.set(key, job);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  private async storeJobs(jobs: InsertJobListing[]): Promise<void> {
    console.log(`💾 Storing ${jobs.length} AI-scraped jobs in database...`);
    
    for (const job of jobs) {
      try {
        // Check if job already exists by external ID
        const existingJob = await this.storage.getJobByExternalId(job.externalId || '');
        
        if (!existingJob) {
          // Also check by title and organization to avoid duplicates
          const allJobs = await this.storage.getJobs();
          const duplicate = allJobs.find(existing => 
            existing.title === job.title && 
            existing.organization === job.organization
          );
          
          if (!duplicate) {
            await this.storage.createJob(job);
            console.log(`✅ Added AI-scraped job: ${job.title}`);
          }
        }
      } catch (error) {
        console.error(`Error storing job ${job.title}:`, error);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Schedule periodic AI-powered job scraping
   */
  async scheduleAIScrapingInterval(intervalMinutes: number = 120): Promise<void> {
    console.log(`⏰ Scheduling AI job scraping every ${intervalMinutes} minutes`);
    
    // Initial scrape
    await this.scrapeJobsWithAI();
    
    // Schedule recurring scrapes
    setInterval(async () => {
      console.log(`🤖 Running scheduled AI job scrape at ${new Date().toISOString()}`);
      await this.scrapeJobsWithAI();
    }, intervalMinutes * 60 * 1000);
  }
}