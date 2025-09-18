import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import { IStorage } from '../storage';
import { InsertJobListing } from '@shared/schema';
import { JobTemplateGenerator } from './job-template-generator';
import { ExternalHttpClient } from './http-client';
import { CacheService } from './cache-service';
import Parser from 'rss-parser';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Curated RSS feeds for Assam job portals
const RSS_FEEDS = [
  { url: 'https://assamjobz.com/feed/', name: 'AssamJobz RSS', ttl: 6 * 60 * 60 * 1000 },
  { url: 'https://www.assamcareer.com/feeds/posts/default', name: 'AssamCareer RSS', ttl: 6 * 60 * 60 * 1000 },
  { url: 'https://govtjobsblog.in/feed', name: 'GovtJobsBlog', ttl: 12 * 60 * 60 * 1000 },
  { url: 'https://services.india.gov.in/feed/index?ln=en', name: 'NationalServices', ttl: 12 * 60 * 60 * 1000 }
];

// Curated job sources for Assam - government and trusted portals
const CURATED_JOB_SOURCES = [
  { 
    url: 'https://apsc.nic.in/latest-updates', 
    name: 'APSC', 
    category: 'Government',
    selectors: {
      jobCards: '.recruitment-notice, .notice-item, table tbody tr',
      title: '.notice-title, td:nth-child(1)',
      link: 'a[href*="pdf"], a[href*="notification"]',
      deadline: '.notice-date, td:nth-child(3)'
    }
  },
  { 
    url: 'https://ssa.assam.gov.in/portlets/recruitment', 
    name: 'SSA Assam', 
    category: 'Government',
    selectors: {
      jobCards: '.table tbody tr, .recruitment-list li',
      title: 'td:nth-child(2), .recruitment-title',
      link: 'td:nth-child(4) a, .download-link a',
      deadline: 'td:nth-child(3), .recruitment-date'
    }
  },
  { 
    url: 'https://dee.assam.gov.in/portlets/recruitment', 
    name: 'DEE Assam', 
    category: 'Government',
    selectors: {
      jobCards: '.table tbody tr, .recruitment-notice',
      title: 'td:nth-child(1), .notice-title',
      link: 'td:nth-child(3) a, .notice-link',
      deadline: 'td:nth-child(2), .notice-date'
    }
  },
  { 
    url: 'https://madhyamik.assam.gov.in/portlets/recruitment', 
    name: 'DSE Assam', 
    category: 'Government',
    selectors: {
      jobCards: '.recruitment-section .item, table tbody tr',
      title: '.item-title, td:nth-child(1)',
      link: '.item-link a, td a[href]',
      deadline: '.item-date, td:nth-child(2)'
    }
  },
  { 
    url: 'https://www.assamcareer.com/search/label/Teaching%20Jobs', 
    name: 'Assam Career', 
    category: 'Portal',
    selectors: {
      jobCards: '.post, article.post-item',
      title: '.post-title a, h2.entry-title a',
      link: '.post-title a, h2.entry-title a',
      description: '.post-body, .entry-content',
      deadline: '.post-date, .entry-date'
    }
  },
  { 
    url: 'https://assamjobz.com/category/teaching-jobs/', 
    name: 'AssamJobz', 
    category: 'Portal',
    selectors: {
      jobCards: '.post-item, article, .job-listing',
      title: '.entry-title a, h2 a, .job-title',
      link: '.entry-title a, h2 a, .job-link',
      description: '.entry-content, .excerpt',
      deadline: '.entry-date, .post-date'
    }
  }
];

// Cache TTLs
const CACHE_TTL = {
  RSS_FEED: 6 * 60 * 60 * 1000,  // 6 hours for RSS feeds
  JOB_PAGE: 12 * 60 * 60 * 1000, // 12 hours for job pages
  AI_SYNTHESIS: 24 * 60 * 60 * 1000 // 24 hours for AI-synthesized content
};

interface SourceType {
  SCRAPED: 'SCRAPED';
  RSS: 'RSS';
  AI_SYNTHESIZED: 'AI_SYNTHESIZED';
}

export class AIJobScraperService {
  private storage: IStorage;
  private processedUrls: Set<string> = new Set();
  private templateGenerator: JobTemplateGenerator;
  private httpClient: ExternalHttpClient;
  private cacheService: CacheService;
  private rssParser: Parser;
  
  constructor(storage: IStorage) {
    this.storage = storage;
    this.templateGenerator = new JobTemplateGenerator(storage);
    
    // Initialize HTTP client with rate limiting and retry logic
    this.httpClient = new ExternalHttpClient({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      globalConcurrency: 5,
      domainConcurrency: 2
    });
    
    // Initialize cache service
    this.cacheService = new CacheService({
      defaultTTL: CACHE_TTL.JOB_PAGE,
      memoryMaxEntries: 100,
      staleWhileRevalidate: true,
      persistToDatabase: true
    });
    
    // Initialize RSS parser
    this.rssParser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AssamJobBot/1.0)'
      }
    });
  }

  /**
   * Main method to search and scrape jobs using both AI providers
   */
  async scrapeJobsWithAI(): Promise<InsertJobListing[]> {
    console.log('🤖 Starting AI-powered job scraping with caching...');
    const allJobs: InsertJobListing[] = [];
    
    try {
      // 1. Fetch from RSS feeds (cached)
      const rssJobs = await this.fetchRSSFeeds();
      allJobs.push(...rssJobs);
      
      // 2. Fetch from curated sources (cached)
      const scrapedJobs = await this.fetchCuratedSources();
      allJobs.push(...scrapedJobs);
      
      // 3. If we have less than 10 jobs, generate AI-synthesized jobs
      if (allJobs.length < 10) {
        console.log('⚠️ Limited real jobs found. Generating AI-synthesized fallback...');
        const synthesizedJobs = await this.generateAISynthesizedJobs(10 - allJobs.length);
        allJobs.push(...synthesizedJobs);
      }
      
      // 4. Deduplicate and validate jobs
      const uniqueJobs = this.deduplicateJobs(allJobs);
      const validatedJobs = await this.validateAndEnrichJobs(uniqueJobs);
      
      // 5. Store jobs in database
      await this.storeJobs(validatedJobs);
      
      console.log(`✅ AI scraping complete. Found ${validatedJobs.length} unique teaching jobs`);
      console.log(`   - RSS feeds: ${rssJobs.length} jobs`);
      console.log(`   - Scraped sources: ${scrapedJobs.length} jobs`);
      console.log(`   - AI-synthesized: ${validatedJobs.filter(j => j.source?.includes('AI_SYNTHESIZED')).length} jobs`);
      
      return validatedJobs;
      
    } catch (error) {
      console.error('Error in AI job scraping:', error);
      // On complete failure, return AI-synthesized jobs
      const fallbackJobs = await this.generateAISynthesizedJobs(5);
      await this.storeJobs(fallbackJobs);
      return fallbackJobs;
    }
  }

  /**
   * Fetch and parse RSS feeds with caching
   */
  private async fetchRSSFeeds(): Promise<InsertJobListing[]> {
    console.log('📡 Fetching RSS feeds with cache...');
    const jobs: InsertJobListing[] = [];
    
    for (const feed of RSS_FEEDS) {
      try {
        const cacheKey = `rss:${feed.url}`;
        
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        let feedData: any;
        
        if (cached && !cached.metadata.stale) {
          console.log(`✅ Cache hit for RSS feed: ${feed.name}`);
          feedData = cached.value;
        } else {
          console.log(`🔄 Fetching RSS feed: ${feed.name}`);
          
          try {
            // Fetch using HTTP client with timeout
            const response = await this.httpClient.get(feed.url, {
              timeout: 15000, // 15 second timeout
              headers: {
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'User-Agent': 'Mozilla/5.0 (compatible; Teacher Portal RSS Reader)'
              }
            });
            
            // Sanitize XML before parsing
            let xmlContent = response.data;
            if (typeof xmlContent === 'string') {
              // Fix common XML issues
              xmlContent = xmlContent.replace(/&(?!(?:amp|lt|gt|quot|#39|#x[0-9a-fA-F]+|#[0-9]+);)/g, '&amp;');
              xmlContent = xmlContent.replace(/<(?!\/?[a-zA-Z][a-zA-Z0-9-_]*(?:\s+[^>]*)?>)/g, '&lt;');
              xmlContent = xmlContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            }
            
            const parsedFeed = await this.rssParser.parseString(xmlContent);
            
            // Cache the parsed feed
            await this.cacheService.set(cacheKey, parsedFeed, {
              ttl: feed.ttl,
              url: feed.url
            });
            
            feedData = parsedFeed;
          } catch (parseError: any) {
            console.error(`Error parsing RSS feed ${feed.name}:`, parseError.message);
            // Cache the error to avoid retrying too frequently
            await this.cacheService.set(cacheKey, { error: true, message: parseError.message }, {
              ttl: 3600000, // Cache errors for 1 hour
              url: feed.url
            });
            continue;
          }
        }
        
        // Extract jobs from feed items
        if (feedData && feedData.items) {
          for (const item of feedData.items.slice(0, 10)) { // Limit to 10 items per feed
            const job = await this.extractJobFromRSSItem(item, feed.name);
            if (job && this.isTeachingJob(job)) {
              jobs.push(job);
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing RSS feed ${feed.name}:`, error.message || error);
      }
    }
    
    return jobs;
  }

  /**
   * Extract job from RSS feed item
   */
  private async extractJobFromRSSItem(item: any, feedName: string): Promise<InsertJobListing | null> {
    try {
      // Use AI to extract structured job data from RSS item
      const prompt = `Extract teaching job information from this RSS feed item.
                     Title: ${item.title}
                     Content: ${item.content || item.contentSnippet || item.description}
                     Link: ${item.link}
                     Date: ${item.pubDate || item.isoDate}
                     
                     Extract and format as JSON with fields:
                     - title, organization, location, description, requirements, salary, deadline, jobType
                     Focus only on teaching positions in Assam.`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Extract structured job data from RSS feed items. Return null if not a teaching job in Assam.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500
      });
      
      const extracted = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      if (extracted && extracted.title) {
        return await this.templateGenerator.formatJobListing({
          title: extracted.title,
          organization: extracted.organization || feedName,
          location: extracted.location || 'Assam',
          description: extracted.description || item.contentSnippet,
          requirements: extracted.requirements || '',
          salary: extracted.salary || '',
          deadline: extracted.deadline || '',
          jobType: extracted.jobType || 'full-time',
          category: 'Teaching',
          tags: ['RSS', feedName],
          source: `RSS:${feedName}`,
          sourceUrl: item.link || '',
          applicationLink: item.link || ''
        });
      }
    } catch (error) {
      console.error('Error extracting job from RSS item:', error);
    }
    
    return null;
  }

  /**
   * Fetch from curated sources with caching
   */
  private async fetchCuratedSources(): Promise<InsertJobListing[]> {
    console.log('🌐 Fetching curated sources with cache...');
    const jobs: InsertJobListing[] = [];
    
    for (const source of CURATED_JOB_SOURCES) {
      try {
        const cacheKey = `source:${source.url}`;
        
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        let pageContent: string;
        
        if (cached && !cached.metadata.stale) {
          console.log(`✅ Cache hit for source: ${source.name}`);
          pageContent = cached.value;
        } else {
          console.log(`🔄 Fetching source: ${source.name}`);
          
          // Fetch using HTTP client
          const response = await this.httpClient.get(source.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          
          pageContent = response.data;
          
          // Cache the page content
          await this.cacheService.set(cacheKey, pageContent, {
            ttl: CACHE_TTL.JOB_PAGE,
            url: source.url
          });
        }
        
        // Extract jobs from page
        const extractedJobs = await this.extractJobsFromPage(pageContent, source);
        jobs.push(...extractedJobs);
        
      } catch (error) {
        console.error(`Error fetching source ${source.name}:`, error);
      }
    }
    
    return jobs;
  }

  /**
   * Extract jobs from HTML page content
   */
  private async extractJobsFromPage(html: string, source: any): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    try {
      const $ = cheerio.load(html);
      const jobCards = $(source.selectors.jobCards);
      
      // Extract basic job information from selectors
      const extractedData: any[] = [];
      
      jobCards.each((_, element) => {
        const title = $(element).find(source.selectors.title).text().trim();
        const link = $(element).find(source.selectors.link).attr('href');
        const deadline = $(element).find(source.selectors.deadline || '').text().trim();
        const description = $(element).find(source.selectors.description || '').text().trim();
        
        if (title) {
          extractedData.push({
            title,
            link: link ? new URL(link, source.url).href : source.url,
            deadline,
            description: description || title,
            source: source.name
          });
        }
      });
      
      // If no structured data found, use AI to extract
      if (extractedData.length === 0 && html.length > 1000) {
        const pageText = $('body').text().slice(0, 5000);
        const aiExtracted = await this.extractJobsWithAI(pageText, source);
        return aiExtracted;
      }
      
      // Format extracted data into job listings
      for (const data of extractedData.slice(0, 10)) { // Limit to 10 jobs per source
        const job = await this.templateGenerator.formatJobListing({
          title: data.title,
          organization: source.name,
          location: 'Assam',
          description: data.description,
          requirements: '',
          salary: '',
          deadline: data.deadline,
          jobType: 'full-time',
          category: source.category,
          tags: [source.category, source.name],
          source: `SCRAPED:${source.name}`,
          sourceUrl: source.url,
          applicationLink: data.link
        });
        
        if (this.isTeachingJob(job)) {
          jobs.push(job);
        }
      }
      
    } catch (error) {
      console.error(`Error extracting jobs from ${source.name}:`, error);
    }
    
    return jobs;
  }

  /**
   * Extract jobs using AI when structured extraction fails
   */
  private async extractJobsWithAI(pageText: string, source: any): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `Extract teaching job listings from this webpage content.
                     Source: ${source.name} (${source.url})
                     Content: ${pageText.substring(0, 3000)}
                     
                     Extract all teaching positions for Assam. For each job, provide:
                     - title: job title
                     - organization: employer name
                     - location: specific location in Assam
                     - description: job details
                     - requirements: qualifications needed
                     - salary: salary information
                     - deadline: application deadline
                     
                     Return as JSON array. Only include actual job postings, not general information.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const listings = JSON.parse(jsonMatch[0]);
        
        for (const item of listings.slice(0, 5)) { // Limit to 5 AI-extracted jobs
          const job = await this.templateGenerator.formatJobListing({
            title: item.title || '',
            organization: item.organization || source.name,
            location: item.location || 'Assam',
            description: item.description || '',
            requirements: item.requirements || '',
            salary: item.salary || '',
            deadline: item.deadline || '',
            jobType: 'full-time',
            category: source.category,
            tags: [source.category, source.name, 'AI-Extracted'],
            source: `SCRAPED:${source.name}`,
            sourceUrl: source.url,
            applicationLink: source.url
          });
          
          jobs.push(job);
        }
      }
    } catch (error) {
      console.error('Error extracting jobs with AI:', error);
    }
    
    return jobs;
  }

  /**
   * Generate AI-synthesized jobs as fallback
   */
  private async generateAISynthesizedJobs(count: number): Promise<InsertJobListing[]> {
    console.log(`🤖 Generating ${count} AI-synthesized teaching jobs...`);
    const jobs: InsertJobListing[] = [];
    
    const teachingPositions = [
      'Primary School Teacher',
      'High School Mathematics Teacher',
      'Science Teacher',
      'English Language Teacher',
      'Computer Science Teacher',
      'Assistant Professor',
      'TET Qualified Teacher',
      'Graduate Teacher',
      'Post Graduate Teacher',
      'Physical Education Teacher'
    ];
    
    const locations = [
      'Guwahati', 'Jorhat', 'Dibrugarh', 'Tezpur', 'Silchar',
      'Nagaon', 'Tinsukia', 'Bongaigaon', 'Nalbari', 'Goalpara'
    ];
    
    const organizations = [
      'Government Higher Secondary School',
      'Kendriya Vidyalaya',
      'Jawahar Navodaya Vidyalaya',
      'State Model School',
      'Government College',
      'District Institute of Education',
      'Government Polytechnic',
      'Assam University'
    ];
    
    try {
      const prompt = `Generate ${count} realistic teaching job openings for Assam, India.
                     Use these position types: ${teachingPositions.join(', ')}
                     Use these locations: ${locations.join(', ')}
                     Use these organization types: ${organizations.join(', ')}
                     
                     For each job, provide:
                     - title: specific teaching position
                     - organization: realistic institution name
                     - location: city/district in Assam
                     - description: detailed job description (100-150 words)
                     - requirements: realistic qualifications (B.Ed, TET, CTET, etc.)
                     - salary: government pay scale or range
                     - applicationDeadline: date 15-30 days from now
                     - category: subject area or level
                     
                     Make them realistic and varied. Return as JSON array.`;
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate realistic teaching job listings for Assam based on current education sector patterns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000
      });
      
      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const listings = parsed.jobs || parsed.listings || [];
        
        for (const item of listings) {
          const job = await this.templateGenerator.formatJobListing({
            title: item.title,
            organization: item.organization,
            location: item.location,
            description: item.description,
            requirements: item.requirements,
            salary: item.salary,
            deadline: item.applicationDeadline,
            jobType: 'full-time',
            category: item.category || 'Teaching',
            tags: ['AI-Generated', 'Synthesized'],
            source: 'AI_SYNTHESIZED',
            sourceUrl: '',
            applicationLink: '',
            aiSummary: '⚠️ This is an AI-synthesized job opportunity based on current market trends. Please verify details with official sources.'
          });
          
          // Add confidence score and synthesized marker
          job.aiSummary = `⚠️ AI-SYNTHESIZED OPPORTUNITY (Confidence: 75%) - ${job.aiSummary || 'This position represents typical opportunities in the education sector. Actual positions may vary.'}`;
          
          jobs.push(job);
        }
      }
    } catch (error) {
      console.error('Error generating AI-synthesized jobs:', error);
    }
    
    return jobs;
  }

  /**
   * Check if a job is teaching-related
   */
  private isTeachingJob(job: InsertJobListing): boolean {
    const teachingKeywords = [
      'teacher', 'teaching', 'educator', 'professor', 'lecturer',
      'instructor', 'tutor', 'faculty', 'academic', 'education',
      'tet', 'b.ed', 'pedagogy', 'classroom', 'school', 'college'
    ];
    
    const combinedText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
    return teachingKeywords.some(keyword => combinedText.includes(keyword));
  }

  /**
   * Deduplicate jobs based on title and organization
   */
  private deduplicateJobs(jobs: InsertJobListing[]): InsertJobListing[] {
    const seen = new Set<string>();
    const unique: InsertJobListing[] = [];
    
    for (const job of jobs) {
      const key = `${job.title?.toLowerCase()}-${job.organization?.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }
    
    return unique;
  }

  /**
   * Validate and enrich jobs
   */
  private async validateAndEnrichJobs(jobs: InsertJobListing[]): Promise<InsertJobListing[]> {
    const validated: InsertJobListing[] = [];
    
    for (const job of jobs) {
      const validatedJob = await this.templateGenerator.validateJobData(job);
      
      // Add source type marker if AI-synthesized
      if (job.source === 'AI_SYNTHESIZED') {
        validatedJob.tags = [...(validatedJob.tags || []), 'AI-Synthesized'];
      }
      
      validated.push(validatedJob);
    }
    
    return validated;
  }

  /**
   * Store jobs in database
   */
  private async storeJobs(jobs: InsertJobListing[]): Promise<void> {
    for (const job of jobs) {
      try {
        await this.storage.createJobListing(job);
        console.log(`💾 Stored job: ${job.title} from ${job.source}`);
      } catch (error) {
        if ((error as any).message?.includes('duplicate')) {
          console.log(`⏭️ Skipping duplicate job: ${job.title}`);
        } else {
          console.error(`Error storing job ${job.title}:`, error);
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    return this.cacheService.getStats();
  }

  /**
   * Clear cache for fresh scraping
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clear();
    console.log('🗑️ Cache cleared');
  }
}