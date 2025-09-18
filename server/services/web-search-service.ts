import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { InsertJobListing } from '@shared/schema';
import { ExternalHttpClient } from './http-client';
import { CacheService } from './cache-service';

// Define types for scraping configuration
interface ScrapingConfig {
  url: string;
  name: string;
  selector?: string;
  titleSelector?: string;
  linkSelector?: string;
  dateSelector?: string;
  descriptionSelector?: string;
  organizationSelector?: string;
  locationSelector?: string;
  salarySelector?: string;
  requirementsSelector?: string;
}

interface WebPageContent {
  url: string;
  html: string;
  text: string;
  title: string;
  links: string[];
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
  };
}

interface JobPortalConfig {
  name: string;
  baseUrl: string;
  searchUrl?: string;
  selectors: {
    jobCards: string;
    title: string;
    link: string;
    organization?: string;
    location?: string;
    salary?: string;
    deadline?: string;
    description?: string;
    requirements?: string;
  };
  headers?: Record<string, string>;
  ttl?: number; // Cache TTL for this portal
}

// Curated job portals configuration - NO GOOGLE SEARCH
const JOB_PORTALS: JobPortalConfig[] = [
  {
    name: 'APSC',
    baseUrl: 'https://apsc.nic.in',
    searchUrl: 'https://apsc.nic.in/latest-updates',
    ttl: 6 * 60 * 60 * 1000, // 6 hours
    selectors: {
      jobCards: '.recruitment-notice, .notice-item, .update-item, table tbody tr',
      title: '.notice-title, td:nth-child(1), .title',
      link: 'a[href*="pdf"], a[href*="notification"], a[href]',
      deadline: '.notice-date, td:nth-child(3), .date',
      organization: '.department'
    }
  },
  {
    name: 'SSA Assam',
    baseUrl: 'https://ssa.assam.gov.in',
    searchUrl: 'https://ssa.assam.gov.in/portlets/recruitment',
    ttl: 6 * 60 * 60 * 1000,
    selectors: {
      jobCards: '.table tbody tr, .recruitment-list li, .notice-board-item',
      title: 'td:nth-child(2), .recruitment-title',
      link: 'td:nth-child(4) a, .download-link a',
      deadline: 'td:nth-child(3), .recruitment-date',
      organization: '.org-name'
    }
  },
  {
    name: 'DEE Assam',
    baseUrl: 'https://dee.assam.gov.in',
    searchUrl: 'https://dee.assam.gov.in/portlets/recruitment',
    ttl: 6 * 60 * 60 * 1000,
    selectors: {
      jobCards: '.table tbody tr, .recruitment-notice',
      title: 'td:nth-child(1), .notice-title',
      link: 'td:nth-child(3) a, .notice-link',
      deadline: 'td:nth-child(2), .notice-date',
      organization: '.department-name'
    }
  },
  {
    name: 'DSE Assam',
    baseUrl: 'https://madhyamik.assam.gov.in',
    searchUrl: 'https://madhyamik.assam.gov.in/portlets/recruitment',
    ttl: 6 * 60 * 60 * 1000,
    selectors: {
      jobCards: '.recruitment-section .item, table tbody tr',
      title: '.item-title, td:nth-child(1)',
      link: '.item-link a, td a[href]',
      deadline: '.item-date, td:nth-child(2)',
      organization: '.organization'
    }
  },
  {
    name: 'Assam Career',
    baseUrl: 'https://www.assamcareer.com',
    searchUrl: 'https://www.assamcareer.com/search/label/Teaching%20Jobs',
    ttl: 12 * 60 * 60 * 1000, // 12 hours for job portals
    selectors: {
      jobCards: '.post, article.post-item',
      title: '.post-title a, h2.entry-title a',
      link: '.post-title a, h2.entry-title a',
      description: '.post-body, .entry-content',
      deadline: '.post-date, .entry-date',
      organization: '.post-labels'
    }
  },
  {
    name: 'AssamJobz',
    baseUrl: 'https://assamjobz.com',
    searchUrl: 'https://assamjobz.com/category/teaching-jobs/',
    ttl: 12 * 60 * 60 * 1000,
    selectors: {
      jobCards: '.post-item, article, .job-listing',
      title: '.entry-title a, h2 a, .job-title',
      link: '.entry-title a, h2 a, .job-link',
      description: '.entry-content, .excerpt, .job-description',
      deadline: '.entry-date, .post-date, .deadline',
      organization: '.company-name, .org-name'
    }
  },
  {
    name: 'Sarkari Result Assam',
    baseUrl: 'https://www.sarkariresult.com',
    searchUrl: 'https://www.sarkariresult.com/assam/',
    ttl: 12 * 60 * 60 * 1000,
    selectors: {
      jobCards: 'ul li, .job-item',
      title: 'a',
      link: 'a',
      deadline: '.date',
      organization: '.org'
    }
  }
];

// RSS feeds for job portals
const RSS_FEEDS = [
  { url: 'https://govtjobsblog.in/feed', name: 'GovtJobsBlog', ttl: 6 * 60 * 60 * 1000 },
  { url: 'https://services.india.gov.in/feed/index?ln=en', name: 'NationalServices', ttl: 12 * 60 * 60 * 1000 },
  { url: 'https://www.srpk.in/index.php?page=rss', name: 'SRPK', ttl: 12 * 60 * 60 * 1000 },
  { url: 'https://assamjobz.com/feed/', name: 'AssamJobz RSS', ttl: 6 * 60 * 60 * 1000 },
  { url: 'https://www.assamcareer.com/feeds/posts/default', name: 'AssamCareer RSS', ttl: 6 * 60 * 60 * 1000 }
];

// Default cache TTLs
const DEFAULT_CACHE_TTL = {
  WEB_PAGE: 12 * 60 * 60 * 1000,  // 12 hours
  RSS_FEED: 6 * 60 * 60 * 1000,   // 6 hours
  JOB_DATA: 24 * 60 * 60 * 1000   // 24 hours
};

export class WebSearchService {
  private rssParser: Parser;
  private httpClient: ExternalHttpClient;
  private cacheService: CacheService;
  
  constructor() {
    // Initialize HTTP client with rate limiting
    this.httpClient = new ExternalHttpClient({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      globalConcurrency: 5,
      domainConcurrency: 2
    });
    
    // Initialize cache service
    this.cacheService = new CacheService({
      defaultTTL: DEFAULT_CACHE_TTL.WEB_PAGE,
      memoryMaxEntries: 50,
      staleWhileRevalidate: true,
      persistToDatabase: true
    });
    
    // Initialize RSS parser
    this.rssParser = new Parser({
      timeout: 30000,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; AssamJobBot/1.0)'
      }
    });
  }
  
  /**
   * NO MORE GOOGLE SEARCH - This method now fetches from curated sources only
   */
  async searchForJobs(query: string, maxResults: number = 5): Promise<Partial<InsertJobListing>[]> {
    console.log(`🔍 Searching for jobs with query: "${query}" (using curated sources only)`);
    const jobs: Partial<InsertJobListing>[] = [];
    
    // Search through curated portals for relevant jobs
    for (const portal of JOB_PORTALS.slice(0, 3)) { // Limit to first 3 portals for efficiency
      try {
        const portalJobs = await this.scrapeJobPortal(portal);
        
        // Filter jobs based on query keywords
        const filteredJobs = portalJobs.filter(job => {
          const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
          const queryWords = query.toLowerCase().split(' ');
          return queryWords.some(word => jobText.includes(word));
        });
        
        jobs.push(...filteredJobs.slice(0, maxResults));
        
        if (jobs.length >= maxResults) break;
      } catch (error) {
        console.error(`Error searching in ${portal.name}:`, error);
      }
    }
    
    return jobs.slice(0, maxResults);
  }
  
  /**
   * Fetch web page content with caching
   */
  async fetchWebPage(url: string): Promise<WebPageContent | null> {
    try {
      const cacheKey = `webpage:${url}`;
      
      // Check cache first
      const cached = await this.cacheService.get<WebPageContent>(cacheKey);
      if (cached && !cached.metadata.stale) {
        console.log(`✅ Cache hit for URL: ${url}`);
        return cached.value;
      }
      
      console.log(`🔄 Fetching fresh content for URL: ${url}`);
      
      // Fetch using HTTP client
      const response = await this.httpClient.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });
      
      if (response.status >= 400) {
        console.warn(`⚠️ HTTP ${response.status} for ${url}`);
        return null;
      }
      
      const $ = cheerio.load(response.data);
      
      // Extract all links from the page
      const links: string[] = [];
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const absoluteUrl = this.resolveUrl(href, url);
          if (absoluteUrl) links.push(absoluteUrl);
        }
      });
      
      // Extract metadata
      const metadata = {
        description: $('meta[name="description"]').attr('content'),
        keywords: $('meta[name="keywords"]').attr('content'),
        author: $('meta[name="author"]').attr('content')
      };
      
      // Extract text content
      const text = $('body').text()
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
      
      const pageContent: WebPageContent = {
        url,
        html: response.data,
        text,
        title: $('title').text() || '',
        links,
        metadata
      };
      
      // Cache the content
      const ttl = JOB_PORTALS.find(p => url.includes(p.baseUrl))?.ttl || DEFAULT_CACHE_TTL.WEB_PAGE;
      await this.cacheService.set(cacheKey, pageContent, { ttl, url });
      
      return pageContent;
      
    } catch (error: any) {
      console.error(`❌ Error fetching ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Scrape job listings from a specific portal
   */
  async scrapeJobPortal(portal: JobPortalConfig): Promise<Partial<InsertJobListing>[]> {
    const jobs: Partial<InsertJobListing>[] = [];
    
    try {
      console.log(`🌐 Scraping website: ${portal.name}`);
      
      const pageContent = await this.fetchWebPage(portal.searchUrl || portal.baseUrl);
      if (!pageContent) return jobs;
      
      const $ = cheerio.load(pageContent.html);
      const jobElements = $(portal.selectors.jobCards);
      
      console.log(`📋 Found ${jobElements.length} potential job cards on ${portal.name}`);
      
      jobElements.each((index, element) => {
        try {
          const $el = $(element);
          
          // Extract job details
          const title = $el.find(portal.selectors.title).first().text().trim() ||
                        $el.find('a').first().text().trim();
          
          if (!title) return;
          
          // Check if it's a teaching job
          if (!this.isTeachingRelated(title)) return;
          
          let link = $el.find(portal.selectors.link).first().attr('href') ||
                    $el.find('a[href]').first().attr('href');
          
          if (link) {
            link = this.resolveUrl(link, portal.baseUrl);
          }
          
          const job: Partial<InsertJobListing> = {
            title: this.cleanText(title),
            organization: portal.selectors.organization ? 
              this.cleanText($el.find(portal.selectors.organization).text()) : portal.name,
            location: portal.selectors.location ?
              this.cleanText($el.find(portal.selectors.location).text()) : 'Assam, India',
            applicationLink: link || portal.searchUrl || portal.baseUrl,
            source: portal.name,
            sourceUrl: portal.searchUrl || portal.baseUrl,
            jobType: 'full-time',
            category: this.categorizeTeachingJob(title),
            isActive: true,
            externalId: `${portal.name}-${index}-${Date.now()}`
          };
          
          // Extract optional fields
          if (portal.selectors.salary) {
            const salary = $el.find(portal.selectors.salary).text();
            if (salary) job.salary = this.extractSalary(salary);
          }
          
          if (portal.selectors.deadline) {
            const deadline = $el.find(portal.selectors.deadline).text();
            if (deadline) job.applicationDeadline = this.parseDate(deadline) as any;
          }
          
          if (portal.selectors.description) {
            const description = $el.find(portal.selectors.description).text();
            if (description) job.description = this.cleanText(description).substring(0, 1000);
          }
          
          if (portal.selectors.requirements) {
            const requirements = $el.find(portal.selectors.requirements).text();
            if (requirements) job.requirements = this.cleanText(requirements);
          }
          
          // Set defaults for missing fields
          if (!job.description) {
            job.description = `Teaching position at ${job.organization}. Please check the official notification for detailed information.`;
          }
          
          if (!job.salary) {
            job.salary = 'As per government norms';
          }
          
          if (!job.requirements) {
            job.requirements = 'As per official notification';
          }
          
          jobs.push(job);
          
        } catch (error) {
          console.error(`Error parsing job element on ${portal.name}:`, error);
        }
      });
      
      console.log(`✅ Extracted ${jobs.length} teaching jobs from ${portal.name}`);
      
    } catch (error) {
      console.error(`Error scraping portal ${portal.name}:`, error);
    }
    
    return jobs;
  }
  
  /**
   * Scrape all configured job portals
   */
  async scrapeAllPortals(): Promise<Partial<InsertJobListing>[]> {
    const allJobs: Partial<InsertJobListing>[] = [];
    
    for (const portal of JOB_PORTALS) {
      const jobs = await this.scrapeJobPortal(portal);
      allJobs.push(...jobs);
    }
    
    return allJobs;
  }
  
  /**
   * Parse RSS feeds for job listings with caching
   */
  async parseRSSFeeds(): Promise<Partial<InsertJobListing>[]> {
    const jobs: Partial<InsertJobListing>[] = [];
    
    for (const feed of RSS_FEEDS) {
      try {
        console.log(`📡 Fetching RSS feed: ${feed.name}`);
        
        const cacheKey = `rss:${feed.url}`;
        
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        let feedData: any;
        
        if (cached && !cached.metadata.stale) {
          console.log(`✅ Cache hit for RSS feed: ${feed.name}`);
          feedData = cached.value;
        } else {
          console.log(`🔄 Fetching fresh RSS feed: ${feed.name}`);
          
          // Fetch RSS feed using HTTP client
          const response = await this.httpClient.get(feed.url, {
            headers: {
              'Accept': 'application/rss+xml, application/xml, text/xml, */*',
              'User-Agent': 'Mozilla/5.0 (compatible; AssamJobBot/1.0)'
            }
          });
          
          // Parse RSS feed
          feedData = await this.rssParser.parseString(response.data);
          
          // Cache the parsed feed
          await this.cacheService.set(cacheKey, feedData, {
            ttl: feed.ttl || DEFAULT_CACHE_TTL.RSS_FEED,
            url: feed.url
          });
        }
        
        // Extract jobs from feed items
        for (const item of feedData.items || []) {
          // Check if it's teaching related
          const title = item.title || '';
          const content = item.content || item.contentSnippet || '';
          
          if (!this.isTeachingRelated(title + ' ' + content)) continue;
          
          const job: Partial<InsertJobListing> = {
            title: this.cleanText(title) || 'Teaching Position',
            description: this.cleanText(content).substring(0, 1000),
            organization: this.extractOrganization(title, content, feed.name),
            location: this.extractLocation(title, content),
            applicationLink: item.link || '',
            source: feed.name,
            sourceUrl: feed.url,
            jobType: 'full-time',
            category: this.categorizeTeachingJob(title),
            isActive: true,
            externalId: item.guid || item.link || `${feed.name}-${Date.now()}`,
            salary: this.extractSalary(content),
            requirements: this.extractRequirements(content),
            applicationDeadline: this.extractDeadline(content) as any
          };
          
          jobs.push(job);
        }
        
        console.log(`✅ Found ${jobs.length} teaching jobs in ${feed.name} RSS feed`);
        
      } catch (error: any) {
        console.error(`Error parsing RSS feed ${feed.name}:`, error.message);
      }
    }
    
    return jobs;
  }
  
  /**
   * Utility methods
   */
  private resolveUrl(href: string, baseUrl: string): string | undefined {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return undefined;
    }
  }
  
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }
  
  private isTeachingRelated(text: string): boolean {
    const keywords = [
      'teacher', 'teaching', 'educator', 'professor', 'lecturer',
      'instructor', 'tutor', 'faculty', 'academic', 'education',
      'tet', 'b.ed', 'school', 'college', 'university'
    ];
    
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }
  
  private categorizeTeachingJob(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('primary')) return 'Primary Education';
    if (lowerTitle.includes('secondary') || lowerTitle.includes('high school')) return 'Secondary Education';
    if (lowerTitle.includes('college') || lowerTitle.includes('university')) return 'Higher Education';
    if (lowerTitle.includes('assistant professor') || lowerTitle.includes('professor')) return 'Higher Education';
    if (lowerTitle.includes('lecturer')) return 'Higher Education';
    if (lowerTitle.includes('kindergarten') || lowerTitle.includes('nursery')) return 'Early Childhood Education';
    if (lowerTitle.includes('special education')) return 'Special Education';
    
    return 'Teaching';
  }
  
  private extractSalary(text: string): string {
    const salaryPatterns = [
      /salary[:\s]+([^\n,]+)/i,
      /pay[:\s]+([^\n,]+)/i,
      /grade pay[:\s]+([^\n,]+)/i,
      /₹[\s]?(\d+[\d,\s-]+)/,
      /rs\.?[\s]?(\d+[\d,\s-]+)/i
    ];
    
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) return this.cleanText(match[1]);
    }
    
    return 'As per government norms';
  }
  
  private extractRequirements(text: string): string {
    const reqPatterns = [
      /qualification[s]?[:\s]+([^.]+\.)/i,
      /eligibility[:\s]+([^.]+\.)/i,
      /requirement[s]?[:\s]+([^.]+\.)/i,
      /b\.ed|m\.ed|tet|ctet|[^.]*degree[^.]+\./gi
    ];
    
    for (const pattern of reqPatterns) {
      const match = text.match(pattern);
      if (match) return this.cleanText(match[0]);
    }
    
    return 'As per official notification';
  }
  
  private extractOrganization(title: string, content: string, defaultOrg: string): string {
    const orgPatterns = [
      /organization[:\s]+([^\n,]+)/i,
      /institution[:\s]+([^\n,]+)/i,
      /school[:\s]+([^\n,]+)/i,
      /college[:\s]+([^\n,]+)/i,
      /university[:\s]+([^\n,]+)/i
    ];
    
    const combinedText = title + ' ' + content;
    
    for (const pattern of orgPatterns) {
      const match = combinedText.match(pattern);
      if (match) return this.cleanText(match[1]);
    }
    
    return defaultOrg;
  }
  
  private extractLocation(title: string, content: string): string {
    // List of Assam districts and cities
    const assamLocations = [
      'Guwahati', 'Jorhat', 'Dibrugarh', 'Tezpur', 'Silchar',
      'Nagaon', 'Tinsukia', 'Bongaigaon', 'Nalbari', 'Goalpara',
      'Kamrup', 'Barpeta', 'Dhubri', 'Darrang', 'Sonitpur',
      'Lakhimpur', 'Dhemaji', 'Morigaon', 'Sivasagar', 'Golaghat',
      'Karbi Anglong', 'Dima Hasao', 'Cachar', 'Hailakandi', 'Karimganj',
      'Kokrajhar', 'Chirang', 'Baksa', 'Udalguri', 'Assam'
    ];
    
    const combinedText = (title + ' ' + content).toLowerCase();
    
    for (const location of assamLocations) {
      if (combinedText.includes(location.toLowerCase())) {
        return location + ', Assam';
      }
    }
    
    return 'Assam, India';
  }
  
  private extractDeadline(text: string): Date | null {
    const deadlinePatterns = [
      /last date[:\s]+([^\n,]+)/i,
      /deadline[:\s]+([^\n,]+)/i,
      /apply by[:\s]+([^\n,]+)/i,
      /closing date[:\s]+([^\n,]+)/i
    ];
    
    for (const pattern of deadlinePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = this.cleanText(match[1]);
        const date = this.parseDate(dateStr);
        if (date) return date;
      }
    }
    
    return null;
  }
  
  private parseDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch {}
    
    return null;
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    return this.cacheService.getStats();
  }
  
  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clear();
    console.log('🗑️ Cache cleared');
  }
}

// Export singleton instance
export const webSearchService = new WebSearchService();