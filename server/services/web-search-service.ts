import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { InsertJobListing } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

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
}

// Known job portals configuration
const JOB_PORTALS: JobPortalConfig[] = [
  {
    name: 'APSC',
    baseUrl: 'https://apsc.nic.in',
    searchUrl: 'https://apsc.nic.in/latest-updates',
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
  { url: 'https://govtjobsblog.in/feed', name: 'GovtJobsBlog' },
  { url: 'https://services.india.gov.in/feed/index?ln=en', name: 'NationalServices' },
  { url: 'https://www.srpk.in/index.php?page=rss', name: 'SRPK' },
  { url: 'https://assamjobz.com/feed/', name: 'AssamJobz RSS' },
  { url: 'https://www.assamcareer.com/feeds/posts/default', name: 'AssamCareer RSS' }
];

export class WebSearchService {
  private rssParser: Parser;
  private userAgents: string[];
  private currentUserAgentIndex: number = 0;
  private requestDelay: number = 1500; // 1.5 seconds between requests
  private lastRequestTime: number = 0;
  private maxRetries: number = 3;
  private timeout: number = 15000; // 15 seconds
  
  constructor() {
    // Initialize user agents first
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    // Now we can use getRandomUserAgent()
    this.rssParser = new Parser({
      timeout: this.timeout,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'User-Agent': this.getRandomUserAgent()
      }
    });
  }
  
  /**
   * Get a random user agent for requests
   */
  private getRandomUserAgent(): string {
    const agent = this.userAgents[this.currentUserAgentIndex];
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
    return agent;
  }
  
  /**
   * Apply rate limiting between requests
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const delay = this.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  /**
   * Check if a URL is a PDF file
   */
  private isPDFUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf') || url.includes('/pdf/') || url.includes('download');
  }
  
  /**
   * Parse PDF content and extract text
   */
  async parsePDFContent(url: string): Promise<string | null> {
    try {
      console.log(`📄 Fetching PDF from: ${url}`);
      await this.applyRateLimit();
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/pdf'
        },
        timeout: 30000 // 30 seconds for PDF downloads
      });
      
      // For now, we'll save the PDF and return a message
      // In production, you'd use a PDF parsing library like pdf-parse or pdfjs-dist
      const pdfPath = path.join('/tmp', `job-${Date.now()}.pdf`);
      fs.writeFileSync(pdfPath, response.data);
      
      console.log(`✅ PDF saved to ${pdfPath}`);
      
      // Return a placeholder text indicating PDF was found
      // In production, extract actual text from PDF
      return `PDF Document found at ${url}. The document may contain job listings. Please check the original PDF for complete details.`;
      
    } catch (error: any) {
      console.error(`Error parsing PDF from ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Handle JavaScript-rendered pages using fallback strategies
   */
  async fetchDynamicContent(url: string): Promise<WebPageContent | null> {
    try {
      console.log(`🎭 Attempting to fetch dynamic content from: ${url}`);
      
      // Strategy 1: Try to find API endpoints or data sources
      const apiEndpoints = await this.findAPIEndpoints(url);
      if (apiEndpoints.length > 0) {
        for (const endpoint of apiEndpoints) {
          const apiData = await this.fetchAPIData(endpoint);
          if (apiData) {
            return {
              url,
              html: JSON.stringify(apiData),
              text: JSON.stringify(apiData, null, 2),
              title: 'API Data',
              links: [],
              metadata: { description: 'Data fetched from API endpoint' }
            };
          }
        }
      }
      
      // Strategy 2: Try common AJAX patterns
      const ajaxData = await this.tryCommonAjaxPatterns(url);
      if (ajaxData) {
        return ajaxData;
      }
      
      // Strategy 3: Fall back to static HTML scraping
      return await this.fetchWebPage(url);
      
    } catch (error: any) {
      console.error(`Error fetching dynamic content from ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Try to find API endpoints from the page
   */
  private async findAPIEndpoints(url: string): Promise<string[]> {
    const endpoints: string[] = [];
    
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.getRandomUserAgent() },
        timeout: 10000
      });
      
      const html = response.data;
      
      // Look for API endpoints in JavaScript code
      const apiPatterns = [
        /fetch\(['"]([^'"]+)['"]\)/g,
        /\.get\(['"]([^'"]+)['"]\)/g,
        /\.post\(['"]([^'"]+)['"]\)/g,
        /apiUrl[:\s=]+['"]([^'"]+)['"]/g,
        /endpoint[:\s=]+['"]([^'"]+)['"]/g,
        /\/api\/[^'")\s]+/g,
        /\.json[?'")\s]/g
      ];
      
      for (const pattern of apiPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const endpoint = match[1] || match[0];
          const absoluteUrl = this.resolveUrl(endpoint, url);
          if (absoluteUrl && !endpoints.includes(absoluteUrl)) {
            endpoints.push(absoluteUrl);
          }
        }
      }
      
    } catch (error) {
      // Silently fail - this is a best-effort approach
    }
    
    return endpoints;
  }
  
  /**
   * Fetch data from API endpoint
   */
  private async fetchAPIData(endpoint: string): Promise<any | null> {
    try {
      const response = await axios.get(endpoint, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000
      });
      
      return response.data;
      
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Try common AJAX patterns for job sites
   */
  private async tryCommonAjaxPatterns(url: string): Promise<WebPageContent | null> {
    const base = new URL(url);
    
    // Common AJAX endpoints for job sites
    const commonPatterns = [
      '/api/jobs',
      '/api/listings',
      '/api/search',
      '/jobs.json',
      '/listings.json',
      '/data/jobs',
      '/ajax/jobs',
      '/wp-admin/admin-ajax.php',
      '/wp-json/wp/v2/posts'
    ];
    
    for (const pattern of commonPatterns) {
      try {
        const ajaxUrl = `${base.protocol}//${base.host}${pattern}`;
        const response = await axios.get(ajaxUrl, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': url
          },
          timeout: 5000
        });
        
        if (response.data) {
          return {
            url: ajaxUrl,
            html: JSON.stringify(response.data),
            text: JSON.stringify(response.data, null, 2),
            title: 'AJAX Data',
            links: [],
            metadata: { description: 'Data fetched via AJAX' }
          };
        }
        
      } catch (error) {
        // Try next pattern
      }
    }
    
    return null;
  }
  
  /**
   * Enhanced fetch method that handles PDFs and dynamic content
   */
  async fetchContent(url: string): Promise<WebPageContent | null> {
    // Check if URL is a PDF
    if (this.isPDFUrl(url)) {
      const pdfText = await this.parsePDFContent(url);
      if (pdfText) {
        return {
          url,
          html: pdfText,
          text: pdfText,
          title: 'PDF Document',
          links: [],
          metadata: { description: 'PDF job notification' }
        };
      }
    }
    
    // First try regular fetch
    let content = await this.fetchWebPage(url);
    
    // If content is minimal or seems to be JS-rendered, try dynamic fetch
    if (!content || content.text.length < 500) {
      const dynamicContent = await this.fetchDynamicContent(url);
      if (dynamicContent && dynamicContent.text.length > (content?.text.length || 0)) {
        content = dynamicContent;
      }
    }
    
    return content;
  }

  /**
   * Fetch a web page with retry logic and error handling
   */
  async fetchWebPage(url: string, config?: AxiosRequestConfig): Promise<WebPageContent | null> {
    await this.applyRateLimit();
    
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`🌐 Fetching URL (attempt ${attempt}/${this.maxRetries}): ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...config?.headers
          },
          timeout: this.timeout,
          maxRedirects: 5,
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
          ...config
        });
        
        if (response.status >= 400) {
          console.warn(`⚠️ HTTP ${response.status} for ${url}`);
          if (response.status === 429) {
            // Rate limited - increase delay
            this.requestDelay = Math.min(this.requestDelay * 2, 10000);
            console.log(`📊 Rate limited. Increasing delay to ${this.requestDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, this.requestDelay));
            continue;
          }
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
        
        return {
          url,
          html: response.data,
          text,
          title: $('title').text() || '',
          links,
          metadata
        };
        
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Error fetching ${url} (attempt ${attempt}):`, error.message);
        
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          // Network error - wait longer before retry
          await new Promise(resolve => setTimeout(resolve, this.requestDelay * 2));
        } else if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
      }
    }
    
    console.error(`❌ Failed to fetch ${url} after ${this.maxRetries} attempts:`, lastError?.message);
    return null;
  }
  
  /**
   * Scrape job listings from a specific portal
   */
  async scrapeJobPortal(portal: JobPortalConfig): Promise<Partial<InsertJobListing>[]> {
    const jobs: Partial<InsertJobListing>[] = [];
    
    try {
      const pageContent = await this.fetchContent(portal.searchUrl || portal.baseUrl);
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
   * Parse RSS feeds for job listings
   */
  async parseRSSFeeds(): Promise<Partial<InsertJobListing>[]> {
    const jobs: Partial<InsertJobListing>[] = [];
    
    for (const feed of RSS_FEEDS) {
      try {
        console.log(`📡 Parsing RSS feed: ${feed.name}`);
        await this.applyRateLimit();
        
        const feedData = await this.rssParser.parseURL(feed.url);
        
        for (const item of feedData.items) {
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
   * Search for jobs using a query
   */
  async searchForJobs(query: string, maxResults: number = 10): Promise<Partial<InsertJobListing>[]> {
    const jobs: Partial<InsertJobListing>[] = [];
    
    // Build search URLs for each portal
    const searchUrls = [
      `https://www.assamcareer.com/search?q=${encodeURIComponent(query)}`,
      `https://assamjobz.com/?s=${encodeURIComponent(query)}`,
      `https://www.google.com/search?q=site:apsc.nic.in+${encodeURIComponent(query)}`,
      `https://www.google.com/search?q=site:ssa.assam.gov.in+${encodeURIComponent(query)}`
    ];
    
    for (const searchUrl of searchUrls) {
      const pageContent = await this.fetchContent(searchUrl);
      if (!pageContent) continue;
      
      // Extract job-related links from search results
      const $ = cheerio.load(pageContent.html);
      const links = pageContent.links.filter(link => 
        this.isJobRelatedUrl(link) && 
        !link.includes('google.com')
      );
      
      // Fetch and parse each relevant link
      for (const link of links.slice(0, Math.floor(maxResults / searchUrls.length))) {
        const jobPage = await this.fetchContent(link);
        if (!jobPage) continue;
        
        const job = await this.extractJobFromPage(jobPage);
        if (job) jobs.push(job);
        
        if (jobs.length >= maxResults) break;
      }
      
      if (jobs.length >= maxResults) break;
    }
    
    return jobs;
  }
  
  /**
   * Extract job information from a single page
   */
  async extractJobFromPage(pageContent: WebPageContent): Promise<Partial<InsertJobListing> | null> {
    try {
      const $ = cheerio.load(pageContent.html);
      const text = pageContent.text;
      
      // Try to extract structured data
      const jsonLd = $('script[type="application/ld+json"]').text();
      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd);
          if (data['@type'] === 'JobPosting') {
            return this.parseStructuredJobData(data, pageContent.url);
          }
        } catch {}
      }
      
      // Fallback to heuristic extraction
      const title = this.extractTitle($, text);
      if (!title || !this.isTeachingRelated(title)) return null;
      
      return {
        title: title,
        description: this.extractDescription($, text),
        organization: this.extractOrganization(title, text, pageContent.url),
        location: this.extractLocation(title, text),
        salary: this.extractSalary(text),
        requirements: this.extractRequirements(text),
        applicationDeadline: this.extractDeadline(text) as any,
        applicationLink: pageContent.url,
        source: new URL(pageContent.url).hostname,
        sourceUrl: pageContent.url,
        jobType: 'full-time',
        category: this.categorizeTeachingJob(title),
        isActive: true,
        externalId: `web-${Date.now()}-${pageContent.url.substring(0, 50)}`
      };
      
    } catch (error) {
      console.error('Error extracting job from page:', error);
      return null;
    }
  }
  
  /**
   * Parse structured job data (JSON-LD)
   */
  private parseStructuredJobData(data: any, url: string): Partial<InsertJobListing> {
    return {
      title: data.title || data.name,
      description: data.description,
      organization: data.hiringOrganization?.name || data.employer?.name,
      location: data.jobLocation?.address?.addressLocality || 
                data.jobLocation?.address?.addressRegion || 
                'Assam, India',
      salary: data.baseSalary?.value?.value || 
              `${data.baseSalary?.value?.minValue}-${data.baseSalary?.value?.maxValue}` ||
              'As per norms',
      requirements: data.qualifications || data.skills || 'As per notification',
      applicationDeadline: data.validThrough ? new Date(data.validThrough) as any : undefined,
      applicationLink: data.url || url,
      source: new URL(url).hostname,
      sourceUrl: url,
      jobType: data.employmentType?.toLowerCase() || 'full-time',
      category: this.categorizeTeachingJob(data.title || ''),
      isActive: true,
      externalId: data.identifier?.value || `structured-${Date.now()}`
    };
  }
  
  // Helper methods
  
  private resolveUrl(relativeUrl: string, baseUrl: string): string {
    try {
      if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
        return relativeUrl;
      }
      
      const base = new URL(baseUrl);
      if (relativeUrl.startsWith('/')) {
        return `${base.protocol}//${base.host}${relativeUrl}`;
      }
      
      // Handle relative paths
      const currentPath = base.pathname.endsWith('/') ? base.pathname : base.pathname + '/';
      return new URL(relativeUrl, `${base.protocol}//${base.host}${currentPath}`).href;
      
    } catch {
      return relativeUrl;
    }
  }
  
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
  
  private isTeachingRelated(text: string): boolean {
    const keywords = [
      'teacher', 'teaching', 'educator', 'instructor', 'professor', 'lecturer',
      'tutor', 'faculty', 'academic', 'education', 'school', 'college',
      'tet', 'ctet', 'b.ed', 'bed', 'm.ed', 'med', 'pedagogy',
      'primary teacher', 'secondary teacher', 'pgt', 'tgt', 'prt',
      'assistant professor', 'associate professor', 'principal', 'headmaster'
    ];
    
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }
  
  private isJobRelatedUrl(url: string): boolean {
    const jobKeywords = [
      'job', 'career', 'recruitment', 'vacancy', 'opening', 'hiring',
      'notification', 'employment', 'opportunity', 'position', 'teacher'
    ];
    
    const lowerUrl = url.toLowerCase();
    return jobKeywords.some(keyword => lowerUrl.includes(keyword));
  }
  
  private categorizeTeachingJob(title: string): string {
    const lower = title.toLowerCase();
    
    if (lower.includes('primary') || lower.includes('prt')) return 'Primary School';
    if (lower.includes('secondary') || lower.includes('tgt')) return 'Secondary School';
    if (lower.includes('higher secondary') || lower.includes('pgt')) return 'Higher Secondary';
    if (lower.includes('college') || lower.includes('professor') || lower.includes('lecturer')) return 'College/University';
    if (lower.includes('principal') || lower.includes('headmaster')) return 'Administration';
    if (lower.includes('special') || lower.includes('inclusive')) return 'Special Education';
    if (lower.includes('computer') || lower.includes('it')) return 'Computer/IT';
    if (lower.includes('english')) return 'English';
    if (lower.includes('math') || lower.includes('mathematics')) return 'Mathematics';
    if (lower.includes('science')) return 'Science';
    if (lower.includes('social')) return 'Social Studies';
    
    return 'Teaching';
  }
  
  private extractTitle($: cheerio.CheerioAPI, text: string): string {
    // Try common title selectors
    const selectors = [
      'h1', '.job-title', '.title', '.heading', 
      '[class*="title"]', '[class*="heading"]'
    ];
    
    for (const selector of selectors) {
      const title = $(selector).first().text().trim();
      if (title && this.isTeachingRelated(title)) {
        return this.cleanText(title);
      }
    }
    
    // Fallback to regex extraction
    const titleMatch = text.match(/(?:job title|position|post|vacancy)[:\s]+([^\n]+)/i);
    if (titleMatch) {
      return this.cleanText(titleMatch[1]);
    }
    
    return '';
  }
  
  private extractDescription($: cheerio.CheerioAPI, text: string): string {
    // Try common description selectors
    const selectors = [
      '.job-description', '.description', '.content',
      '[class*="description"]', '[class*="content"]'
    ];
    
    for (const selector of selectors) {
      const desc = $(selector).first().text().trim();
      if (desc && desc.length > 50) {
        return this.cleanText(desc).substring(0, 1000);
      }
    }
    
    // Fallback to extracting a portion of the text
    return this.cleanText(text).substring(0, 1000);
  }
  
  private extractOrganization(title: string, content: string, source: string): string {
    const patterns = [
      /(?:organization|employer|company|school|college|university|department)[:\s]+([^\n,]+)/i,
      /(?:at|with|for)\s+([A-Z][^\s,]+(?:\s+[A-Z][^\s,]+)*)/,
      /([A-Z]+(?:\s+[A-Z]+)*)\s+(?:invites|announces|requires|recruitment)/i
    ];
    
    const text = title + ' ' + content;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.cleanText(match[1]);
      }
    }
    
    // Fallback to source domain
    try {
      const hostname = new URL(source).hostname;
      if (hostname.includes('apsc')) return 'Assam Public Service Commission';
      if (hostname.includes('ssa')) return 'Sarva Shiksha Abhiyan, Assam';
      if (hostname.includes('dee')) return 'Directorate of Elementary Education, Assam';
      return hostname.replace('www.', '').split('.')[0];
    } catch {
      return 'Government of Assam';
    }
  }
  
  private extractLocation(title: string, content: string): string {
    const assamLocations = [
      'Guwahati', 'Jorhat', 'Dibrugarh', 'Tezpur', 'Silchar', 'Nagaon',
      'Tinsukia', 'Bongaigaon', 'Kokrajhar', 'Dhubri', 'Goalpara',
      'Barpeta', 'Nalbari', 'Kamrup', 'Sonitpur', 'Lakhimpur', 'Dhemaji',
      'Sivasagar', 'Golaghat', 'Cachar', 'Karimganj', 'Hailakandi',
      'Karbi Anglong', 'Dima Hasao', 'Assam', 'North East', 'NE India'
    ];
    
    const text = (title + ' ' + content).toLowerCase();
    
    for (const location of assamLocations) {
      if (text.includes(location.toLowerCase())) {
        return location + ', Assam, India';
      }
    }
    
    return 'Assam, India';
  }
  
  private extractSalary(text: string): string {
    const patterns = [
      /(?:salary|pay|pay scale|remuneration)[:\s]+([\d,]+(?:\s*-\s*[\d,]+)?(?:\s*(?:per month|pm|p\.m\.|monthly))?)/i,
      /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\s*-\s*[\d,]+)?)/i,
      /pay\s*(?:band|scale)?\s*[:\s]*([\d,]+(?:\s*-\s*[\d,]+)?)/i,
      /grade\s*pay\s*[:\s]*([\d,]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return 'Rs. ' + match[1];
      }
    }
    
    return 'As per government norms';
  }
  
  private extractRequirements(text: string): string {
    const patterns = [
      /(?:eligibility|qualification|requirements?|criteria)[:\s]+([^.]+(?:\.[^.]+){0,2})/i,
      /(?:must have|should have|required)[:\s]+([^.]+(?:\.[^.]+){0,2})/i,
      /(?:education|degree|qualification)[:\s]+([^.]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.cleanText(match[1]).substring(0, 500);
      }
    }
    
    return 'As per official notification';
  }
  
  private extractDeadline(text: string): Date | null {
    const patterns = [
      /(?:last date|deadline|closing date|apply before)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /(?:last date|deadline|closing date|apply before)[:\s]+(\d{1,2}\s+\w+\s+\d{2,4})/i,
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:is the last date)/i,
      /apply\s+(?:by|before)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        } catch {}
      }
    }
    
    return null;
  }
  
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch {}
    
    // Try parsing DD/MM/YYYY or DD-MM-YYYY
    const match = dateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
      const year = parseInt(match[3]) < 100 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
      return new Date(year, month, day);
    }
    
    return null;
  }
}

// Export singleton instance
export const webSearchService = new WebSearchService();