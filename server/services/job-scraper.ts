import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { IStorage } from '../storage';
import { InsertJobListing } from '@shared/schema';

// RSS feed sources for government jobs
const RSS_FEEDS = [
  { url: 'https://govtjobsblog.in/feed', name: 'GovtJobsBlog' },
  { url: 'https://services.india.gov.in/feed/index?ln=en', name: 'NationalServices' },
  { url: 'https://www.srpk.in/index.php?page=rss', name: 'SRPK' },
];

// Direct web scraping sources for Assam teaching jobs
const WEB_SOURCES = [
  { 
    url: 'https://apsc.nic.in/latest-updates',
    name: 'APSC',
    selector: '.recruitment-notice',
    titleSelector: '.notice-title',
    linkSelector: 'a[href]',
    dateSelector: '.notice-date'
  },
  {
    url: 'https://ssa.assam.gov.in/portlets/recruitment',
    name: 'SSA Assam',
    selector: '.table tbody tr',
    titleSelector: 'td:nth-child(2)',
    linkSelector: 'td:nth-child(4) a',
    dateSelector: 'td:nth-child(3)'
  },
  {
    url: 'https://dee.assam.gov.in/portlets/recruitment',
    name: 'DEE Assam',
    selector: '.table tbody tr',
    titleSelector: 'td:nth-child(1)',
    linkSelector: 'td:nth-child(3) a',
    dateSelector: 'td:nth-child(2)'
  }
];

// Job aggregator APIs
const AGGREGATOR_SOURCES = [
  {
    url: 'https://www.assamcareer.com/search/label/Teaching%20Jobs',
    name: 'AssamCareer',
    type: 'html'
  },
  {
    url: 'https://assamjobz.com/category/teaching-jobs/',
    name: 'AssamJobz',
    type: 'html'
  }
];

export class JobScraperService {
  private rssParser: Parser;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.rssParser = new Parser();
    this.storage = storage;
  }

  // Main scraping function
  async scrapeAllJobs(): Promise<void> {
    console.log('🔍 Starting job scraping...');
    
    const allJobs: InsertJobListing[] = [];
    
    // 1. Fetch from RSS feeds
    const rssJobs = await this.scrapeRSSFeeds();
    allJobs.push(...rssJobs);
    
    // 2. Scrape web sources
    const webJobs = await this.scrapeWebSources();
    allJobs.push(...webJobs);
    
    // 3. Scrape aggregators
    const aggregatorJobs = await this.scrapeAggregators();
    allJobs.push(...aggregatorJobs);
    
    // 4. Filter and deduplicate jobs
    const teachingJobs = this.filterTeachingJobs(allJobs);
    const uniqueJobs = this.deduplicateJobs(teachingJobs);
    
    // 5. Store jobs in database
    await this.storeJobs(uniqueJobs);
    
    console.log(`✅ Scraping complete. Found ${uniqueJobs.length} unique teaching jobs`);
  }

  // Scrape RSS feeds
  async scrapeRSSFeeds(): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    for (const feed of RSS_FEEDS) {
      try {
        console.log(`📡 Fetching RSS feed: ${feed.name}`);
        const feedData = await this.rssParser.parseURL(feed.url);
        
        for (const item of feedData.items) {
          // Check if it's a teaching job
          if (this.isTeachingJob(item.title || '', item.content || '')) {
            jobs.push({
              title: item.title || 'Teaching Position',
              description: this.cleanDescription(item.content || item.contentSnippet || ''),
              organization: this.extractCompany(item.title || '', feed.name),
              location: this.extractLocation(item.title || '', item.content || ''),
              salary: this.extractSalary(item.content || ''),
              jobType: 'full-time',
              category: 'Teaching',
              requirements: this.extractRequirements(item.content || ''),
              applicationDeadline: this.extractDeadline(item.content || ''),
              isActive: true,
              applicationLink: item.link || '',
              source: feed.name,
              sourceUrl: '',
              externalId: item.guid || item.link || ''
            });
          }
        }
      } catch (error) {
        console.error(`Error scraping RSS feed ${feed.name}:`, error);
      }
    }
    
    return jobs;
  }

  // Scrape direct web sources
  async scrapeWebSources(): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    for (const source of WEB_SOURCES) {
      try {
        console.log(`🌐 Scraping website: ${source.name}`);
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        const elements = $(source.selector);
        
        elements.each((index, element) => {
          const title = $(element).find(source.titleSelector).text().trim();
          const link = $(element).find(source.linkSelector).attr('href');
          const date = $(element).find(source.dateSelector).text().trim();
          
          if (title && this.isTeachingJob(title, '')) {
            jobs.push({
              title: title,
              description: `Government teaching position in Assam. Check official website for details.`,
              organization: source.name,
              location: 'Assam, India',
              salary: 'As per government norms',
              jobType: 'full-time',
              category: 'Teaching',
              requirements: 'As per official notification',
              applicationDeadline: this.parseDate(date),
              isActive: true,
              applicationLink: link ? (link.startsWith('http') ? link : `https://${new URL(source.url).hostname}${link}`) : source.url,
              source: source.name,
              sourceUrl: source.url,
              externalId: `${source.name}-${title.replace(/\s+/g, '-').toLowerCase()}`
            });
          }
        });
      } catch (error) {
        console.error(`Error scraping website ${source.name}:`, error);
      }
    }
    
    return jobs;
  }

  // Scrape job aggregator sites
  async scrapeAggregators(): Promise<InsertJobListing[]> {
    const jobs: InsertJobListing[] = [];
    
    for (const source of AGGREGATOR_SOURCES) {
      try {
        console.log(`📊 Scraping aggregator: ${source.name}`);
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // AssamCareer specific selectors
        if (source.name === 'AssamCareer') {
          $('.post').each((index, element) => {
            const title = $(element).find('.post-title a').text().trim();
            const link = $(element).find('.post-title a').attr('href');
            const content = $(element).find('.post-body').text().trim();
            const date = $(element).find('.post-date').text().trim();
            
            if (title && this.isTeachingJob(title, content)) {
              jobs.push({
                title: title,
                description: this.cleanDescription(content.substring(0, 500)),
                organization: this.extractCompany(title, 'Government of Assam'),
                location: this.extractLocation(title, content),
                salary: this.extractSalary(content),
                jobType: 'full-time',
                category: 'Teaching',
                requirements: this.extractRequirements(content),
                applicationDeadline: this.extractDeadline(content),
                isActive: true,
                applicationLink: link || source.url,
                source: source.name,
                sourceUrl: source.url,
                externalId: `${source.name}-${index}`
              });
            }
          });
        }
        
        // AssamJobz specific selectors
        if (source.name === 'AssamJobz') {
          $('.post-item, article').each((index, element) => {
            const title = $(element).find('.entry-title a, h2 a').text().trim();
            const link = $(element).find('.entry-title a, h2 a').attr('href');
            const content = $(element).find('.entry-content, .excerpt').text().trim();
            const date = $(element).find('.entry-date, .post-date').text().trim();
            
            if (title) {
              jobs.push({
                title: title,
                description: this.cleanDescription(content.substring(0, 500)),
                organization: this.extractCompany(title, 'Government of Assam'),
                location: 'Assam, India',
                salary: this.extractSalary(content),
                jobType: 'full-time',
                category: 'Teaching',
                requirements: this.extractRequirements(content),
                applicationDeadline: this.extractDeadline(content),
                isActive: true,
                applicationLink: link || source.url,
                source: source.name,
                sourceUrl: source.url,
                externalId: `${source.name}-${index}`
              });
            }
          });
        }
      } catch (error) {
        console.error(`Error scraping aggregator ${source.name}:`, error);
      }
    }
    
    return jobs;
  }

  // Helper functions
  private isTeachingJob(title: string, content: string): boolean {
    const keywords = [
      'teacher', 'teaching', 'educator', 'professor', 'lecturer',
      'assistant teacher', 'TET', 'B.Ed', 'M.Ed', 'education',
      'school', 'college', 'university', 'academic', 'faculty',
      'শিক্ষক', 'টিচার' // Assamese/Bengali terms
    ];
    
    const combined = (title + ' ' + content).toLowerCase();
    return keywords.some(keyword => combined.includes(keyword.toLowerCase()));
  }

  private cleanDescription(text: string): string {
    // Remove HTML tags and clean up text
    return text.replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
      .substring(0, 1000);
  }

  private extractCompany(title: string, defaultCompany: string): string {
    // Try to extract organization name from title
    const patterns = [
      /(?:at|in|for)\s+([A-Z][A-Za-z\s]+(?:School|College|University|Institute|Department))/i,
      /([A-Z][A-Za-z\s]+(?:Board|Commission|Council|Ministry))/i,
      /(?:APSC|SEBA|SSA|DEE|NHM|SCERT)/i
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) return match[1] || match[0];
    }
    
    return defaultCompany;
  }

  private extractLocation(title: string, content: string): string {
    const combined = title + ' ' + content;
    const locations = [
      'Guwahati', 'Jorhat', 'Dibrugarh', 'Tezpur', 'Silchar',
      'Nagaon', 'Tinsukia', 'Bongaigaon', 'Kokrajhar', 'Dhubri',
      'Goalpara', 'Barpeta', 'Nalbari', 'Kamrup', 'Sonitpur',
      'Assam'
    ];
    
    for (const location of locations) {
      if (combined.toLowerCase().includes(location.toLowerCase())) {
        return `${location}, Assam, India`;
      }
    }
    
    return 'Assam, India';
  }

  private extractSalary(content: string): string {
    // Try to extract salary information
    const patterns = [
      /(?:salary|pay|compensation)[:\s]+(?:Rs\.?|INR|₹)\s*([\d,]+)/i,
      /(?:Rs\.?|INR|₹)\s*([\d,]+)\s*(?:-|to)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+)/i,
      /pay\s*(?:scale|band)[:\s]*([\d,\-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        if (match[2]) {
          return `₹${match[1]} - ₹${match[2]}`;
        }
        return `₹${match[1]}`;
      }
    }
    
    return 'As per government norms';
  }

  private extractRequirements(content: string): string {
    const patterns = [
      /(?:eligibility|qualification|requirements?)[:\s]+([^.]+\.[^.]*)/i,
      /(?:must have|required|essential)[:\s]+([^.]+)/i,
      /(?:B\.Ed|M\.Ed|TET|CTET|Graduate|Post Graduate)[^.]*\./gi
    ];
    
    const requirements: string[] = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        requirements.push(matches[0]);
      }
    }
    
    return requirements.length > 0 
      ? requirements.join(' ').substring(0, 500)
      : 'Please check official notification for detailed requirements';
  }

  private extractDeadline(content: string): Date | null {
    const patterns = [
      /(?:last date|deadline|apply before)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(?:applications? (?:close|end)|closing date)[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*(?:is the last date)/i
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const dateStr = match[1];
        const date = this.parseDate(dateStr);
        if (date) return date;
      }
    }
    
    // Default to 30 days from now if no deadline found
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    return deadline;
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      // Try different date formats
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date;
      
      // Try DD-MM-YYYY or DD/MM/YYYY format
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Months are 0-indexed
        const year = parseInt(parts[2]);
        const parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
      }
    } catch (error) {
      console.error('Error parsing date:', dateStr);
    }
    
    return null;
  }

  private filterTeachingJobs(jobs: InsertJobListing[]): InsertJobListing[] {
    return jobs.filter(job => {
      // Additional filtering to ensure we only get teaching jobs
      const relevantText = (job.title + ' ' + job.description + ' ' + job.requirements).toLowerCase();
      
      // Must contain teaching-related keywords
      const hasTeachingKeywords = [
        'teacher', 'teaching', 'education', 'school', 'college',
        'professor', 'lecturer', 'faculty', 'academic', 'tet'
      ].some(keyword => relevantText.includes(keyword));
      
      // Should be in Assam
      const isInAssam = job.location.toLowerCase().includes('assam');
      
      return hasTeachingKeywords && isInAssam;
    });
  }

  private deduplicateJobs(jobs: InsertJobListing[]): InsertJobListing[] {
    const seen = new Map<string, InsertJobListing>();
    
    for (const job of jobs) {
      // Create a unique key based on title and organization
      const key = `${job.title.toLowerCase().replace(/\s+/g, '-')}-${job.organization.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, job);
      }
    }
    
    return Array.from(seen.values());
  }

  private async storeJobs(jobs: InsertJobListing[]): Promise<void> {
    console.log(`💾 Storing ${jobs.length} jobs in database...`);
    
    for (const job of jobs) {
      try {
        // Check if job already exists
        const existingJobs = await this.storage.getJobs();
        const exists = existingJobs.some(existing => 
          existing.externalId === job.externalId ||
          (existing.title === job.title && existing.organization === job.organization)
        );
        
        if (!exists) {
          await this.storage.createJob(job);
          console.log(`✅ Added new job: ${job.title}`);
        }
      } catch (error) {
        console.error(`Error storing job ${job.title}:`, error);
      }
    }
  }

  // Scheduled scraping function
  async scheduleScrapingInterval(intervalMinutes: number = 60): void {
    console.log(`⏰ Scheduling job scraping every ${intervalMinutes} minutes`);
    
    // Initial scrape
    await this.scrapeAllJobs();
    
    // Schedule recurring scrapes
    setInterval(async () => {
      console.log(`⏰ Running scheduled job scrape at ${new Date().toISOString()}`);
      await this.scrapeAllJobs();
    }, intervalMinutes * 60 * 1000);
  }
}