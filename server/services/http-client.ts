import axios, { AxiosRequestConfig, AxiosResponse, AxiosError, Method } from 'axios';
import { EventEmitter } from 'events';

// Types and interfaces
interface RequestQueueItem {
  id: string;
  url: string;
  config: AxiosRequestConfig;
  resolve: (value: AxiosResponse) => void;
  reject: (reason: any) => void;
  retryCount: number;
  timestamp: number;
}

interface DomainQueue {
  queue: RequestQueueItem[];
  processing: number;
  lastRequestTime: number;
  consecutiveFailures: number;
  circuitBreakerOpenUntil: number | null;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownDurationMs: number;
  halfOpenRequests: number;
}

interface HttpClientConfig {
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  maxRetries?: number;
  globalConcurrency?: number;
  domainConcurrency?: number;
  minTimeBetweenRequests?: number;
  circuitBreaker?: CircuitBreakerConfig;
  timeout?: number;
  headers?: Record<string, string>;
}

interface DomainStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  lastError?: string;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}

// Default configuration
const DEFAULT_CONFIG: Required<HttpClientConfig> = {
  baseDelay: parseInt(process.env.HTTP_BASE_DELAY || '500'),
  maxDelay: parseInt(process.env.HTTP_MAX_DELAY || '30000'),
  backoffFactor: parseFloat(process.env.HTTP_BACKOFF_FACTOR || '2'),
  maxRetries: parseInt(process.env.HTTP_MAX_RETRIES || '3'),
  globalConcurrency: parseInt(process.env.HTTP_GLOBAL_CONCURRENCY || '10'),
  domainConcurrency: parseInt(process.env.HTTP_DOMAIN_CONCURRENCY || '2'),
  minTimeBetweenRequests: parseInt(process.env.HTTP_MIN_TIME_BETWEEN_REQUESTS || '1500'),
  circuitBreaker: {
    failureThreshold: parseInt(process.env.HTTP_CB_FAILURE_THRESHOLD || '5'),
    cooldownDurationMs: parseInt(process.env.HTTP_CB_COOLDOWN_MS || '600000'), // 10 minutes
    halfOpenRequests: parseInt(process.env.HTTP_CB_HALFOPEN_REQUESTS || '3')
  },
  timeout: parseInt(process.env.HTTP_TIMEOUT || '30000'),
  headers: {}
};

/**
 * ExternalHttpClient - A robust HTTP client with:
 * - Exponential backoff with jitter
 * - Per-domain request queues
 * - Circuit breaker pattern
 * - Global concurrency limit
 * - Retry logic with Retry-After header support
 */
export class ExternalHttpClient extends EventEmitter {
  private config: Required<HttpClientConfig>;
  private domainQueues: Map<string, DomainQueue> = new Map();
  private globalProcessing: number = 0;
  private domainStats: Map<string, DomainStats> = new Map();
  private requestIdCounter: number = 0;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: HttpClientConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start the queue processor
    this.startQueueProcessor();
    
    console.log('🚀 ExternalHttpClient initialized with config:', {
      globalConcurrency: this.config.globalConcurrency,
      domainConcurrency: this.config.domainConcurrency,
      maxRetries: this.config.maxRetries,
      baseDelay: this.config.baseDelay,
      maxDelay: this.config.maxDelay
    });
  }

  /**
   * Make an HTTP request with all the bells and whistles
   */
  async request<T = any>(
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    const domain = this.extractDomain(url);
    
    // Check circuit breaker
    const circuitState = this.checkCircuitBreaker(domain);
    if (circuitState === 'open') {
      const stats = this.domainStats.get(domain);
      const error = new Error(
        `Circuit breaker OPEN for domain ${domain}. Too many consecutive failures.`
      );
      (error as any).code = 'CIRCUIT_BREAKER_OPEN';
      (error as any).domain = domain;
      (error as any).stats = stats;
      this.emit('circuit-breaker-open', { domain, stats });
      throw error;
    }

    // Create request item
    const requestId = `req-${++this.requestIdCounter}-${Date.now()}`;
    const requestItem = await this.createRequestItem(requestId, url, config);
    
    // Add to domain queue
    this.addToQueue(domain, requestItem);
    
    // Process queues
    this.processQueues();
    
    // Return promise that will be resolved when request completes
    return new Promise<AxiosResponse<T>>((resolve, reject) => {
      requestItem.resolve = resolve as any;
      requestItem.reject = reject;
    });
  }

  /**
   * Convenience methods for different HTTP methods
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PATCH', data });
  }

  /**
   * Get statistics for a specific domain
   */
  getDomainStats(domain: string): DomainStats | undefined {
    return this.domainStats.get(domain);
  }

  /**
   * Get all domain statistics
   */
  getAllStats(): Map<string, DomainStats> {
    return new Map(this.domainStats);
  }

  /**
   * Reset circuit breaker for a domain
   */
  resetCircuitBreaker(domain: string): void {
    const queue = this.domainQueues.get(domain);
    if (queue) {
      queue.consecutiveFailures = 0;
      queue.circuitBreakerOpenUntil = null;
    }
    
    const stats = this.domainStats.get(domain);
    if (stats) {
      stats.circuitBreakerState = 'closed';
    }
    
    console.log(`🔄 Circuit breaker reset for domain: ${domain}`);
    this.emit('circuit-breaker-reset', { domain });
  }

  /**
   * Clear all queues and stop processing
   */
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval as NodeJS.Timeout);
      this.processingInterval = null;
    }
    
    // Reject all pending requests
    for (const [domain, queue] of Array.from(this.domainQueues)) {
      for (const item of queue.queue) {
        item.reject(new Error('Client destroyed'));
      }
    }
    
    this.domainQueues.clear();
    this.domainStats.clear();
    this.removeAllListeners();
  }

  // Private methods

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // Fallback for invalid URLs
      return 'unknown';
    }
  }

  private async createRequestItem(
    id: string,
    url: string,
    config: AxiosRequestConfig
  ): Promise<RequestQueueItem> {
    return {
      id,
      url,
      config: {
        ...config,
        timeout: config.timeout || this.config.timeout,
        headers: {
          ...this.config.headers,
          ...config.headers
        }
      },
      resolve: () => {},
      reject: () => {},
      retryCount: 0,
      timestamp: Date.now()
    };
  }

  private addToQueue(domain: string, item: RequestQueueItem): void {
    if (!this.domainQueues.has(domain)) {
      this.domainQueues.set(domain, {
        queue: [],
        processing: 0,
        lastRequestTime: 0,
        consecutiveFailures: 0,
        circuitBreakerOpenUntil: null
      });
    }
    
    const queue = this.domainQueues.get(domain)!;
    queue.queue.push(item);
    
    this.emit('request-queued', { 
      domain, 
      queueLength: queue.queue.length,
      requestId: item.id 
    });
  }

  private startQueueProcessor(): void {
    // Process queues every 100ms
    this.processingInterval = setInterval(() => {
      this.processQueues();
    }, 100) as NodeJS.Timeout;
  }

  private processQueues(): void {
    for (const [domain, queue] of Array.from(this.domainQueues)) {
      this.processDomainQueue(domain, queue);
    }
  }

  private processDomainQueue(domain: string, queue: DomainQueue): void {
    // Skip if circuit breaker is open
    if (queue.circuitBreakerOpenUntil && Date.now() < queue.circuitBreakerOpenUntil) {
      // Try half-open state
      if (queue.queue.length > 0 && queue.processing === 0) {
        const halfOpenTime = queue.circuitBreakerOpenUntil - (this.config.circuitBreaker.cooldownDurationMs / 2);
        if (Date.now() > halfOpenTime) {
          this.updateCircuitBreakerState(domain, 'half-open');
          // Allow one request through
          this.processNextInQueue(domain, queue);
        }
      }
      return;
    }

    // Check concurrency limits
    if (queue.processing >= this.config.domainConcurrency) {
      return;
    }
    
    if (this.globalProcessing >= this.config.globalConcurrency) {
      return;
    }
    
    // Check rate limiting
    const timeSinceLastRequest = Date.now() - queue.lastRequestTime;
    if (timeSinceLastRequest < this.config.minTimeBetweenRequests) {
      return;
    }
    
    // Process next item in queue
    if (queue.queue.length > 0) {
      this.processNextInQueue(domain, queue);
    }
  }

  private async processNextInQueue(domain: string, queue: DomainQueue): Promise<void> {
    const item = queue.queue.shift();
    if (!item) return;
    
    queue.processing++;
    queue.lastRequestTime = Date.now();
    this.globalProcessing++;
    
    try {
      const startTime = Date.now();
      const response = await this.executeRequest(item);
      const responseTime = Date.now() - startTime;
      
      // Update statistics
      this.updateDomainStats(domain, true, responseTime);
      
      // Reset consecutive failures on success
      queue.consecutiveFailures = 0;
      
      // If circuit breaker was half-open, close it
      if (this.getCircuitBreakerState(domain) === 'half-open') {
        this.updateCircuitBreakerState(domain, 'closed');
        this.resetCircuitBreaker(domain);
      }
      
      item.resolve(response);
      
      this.emit('request-success', { 
        domain, 
        requestId: item.id,
        responseTime,
        retryCount: item.retryCount
      });
      
    } catch (error) {
      await this.handleRequestError(domain, queue, item, error as Error);
    } finally {
      queue.processing--;
      this.globalProcessing--;
    }
  }

  private async executeRequest(item: RequestQueueItem): Promise<AxiosResponse> {
    try {
      return await axios.request({
        url: item.url,
        ...item.config
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Check for rate limiting
        if (error.response?.status === 429 || error.response?.status === 503) {
          const retryAfter = this.parseRetryAfter(error.response.headers['retry-after']);
          if (retryAfter > 0) {
            await this.delay(retryAfter);
          }
        }
      }
      throw error;
    }
  }

  private async handleRequestError(
    domain: string,
    queue: DomainQueue,
    item: RequestQueueItem,
    error: Error
  ): Promise<void> {
    item.retryCount++;
    
    // Update statistics
    this.updateDomainStats(domain, false, 0, error.message);
    
    // Check if we should retry
    const shouldRetry = this.shouldRetry(error, item);
    
    if (shouldRetry && item.retryCount <= this.config.maxRetries) {
      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateBackoffDelay(item.retryCount);
      
      this.emit('request-retry', {
        domain,
        requestId: item.id,
        retryCount: item.retryCount,
        delay,
        error: error.message
      });
      
      // Wait and re-queue
      await this.delay(delay);
      queue.queue.unshift(item); // Add back to front of queue
      
    } else {
      // Final failure
      queue.consecutiveFailures++;
      
      // Check if we should open circuit breaker
      if (queue.consecutiveFailures >= this.config.circuitBreaker.failureThreshold) {
        this.openCircuitBreaker(domain, queue);
      }
      
      item.reject(error);
      
      this.emit('request-failed', {
        domain,
        requestId: item.id,
        retryCount: item.retryCount,
        error: error.message,
        consecutiveFailures: queue.consecutiveFailures
      });
    }
  }

  private shouldRetry(error: Error, item: RequestQueueItem): boolean {
    if (axios.isAxiosError(error)) {
      // Don't retry client errors (4xx) except for specific ones
      if (error.response) {
        const status = error.response.status;
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return retryableStatuses.includes(status);
      }
      
      // Retry network errors
      if (error.code === 'ECONNABORTED' || 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ECONNRESET') {
        return true;
      }
    }
    
    return false;
  }

  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = this.config.baseDelay;
    const factor = this.config.backoffFactor;
    const maxDelay = this.config.maxDelay;
    
    // Exponential backoff
    let delay = baseDelay * Math.pow(factor, retryCount - 1);
    
    // Add jitter (0-25% of delay)
    const jitter = delay * Math.random() * 0.25;
    delay += jitter;
    
    // Cap at max delay
    return Math.min(delay, maxDelay);
  }

  private parseRetryAfter(retryAfter: string | undefined): number {
    if (!retryAfter) return 0;
    
    // Check if it's a number (seconds)
    const seconds = parseInt(retryAfter);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
    
    // Check if it's a date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      const delay = date.getTime() - Date.now();
      return Math.max(0, delay);
    }
    
    return 0;
  }

  private checkCircuitBreaker(domain: string): 'open' | 'half-open' | 'closed' {
    const queue = this.domainQueues.get(domain);
    if (!queue) return 'closed';
    
    if (queue.circuitBreakerOpenUntil) {
      if (Date.now() < queue.circuitBreakerOpenUntil) {
        const halfOpenTime = queue.circuitBreakerOpenUntil - (this.config.circuitBreaker.cooldownDurationMs / 2);
        if (Date.now() > halfOpenTime) {
          return 'half-open';
        }
        return 'open';
      } else {
        // Circuit breaker timeout expired
        queue.circuitBreakerOpenUntil = null;
        queue.consecutiveFailures = 0;
      }
    }
    
    return 'closed';
  }

  private getCircuitBreakerState(domain: string): 'open' | 'half-open' | 'closed' {
    return this.checkCircuitBreaker(domain);
  }

  private openCircuitBreaker(domain: string, queue: DomainQueue): void {
    queue.circuitBreakerOpenUntil = Date.now() + this.config.circuitBreaker.cooldownDurationMs;
    
    this.updateCircuitBreakerState(domain, 'open');
    
    console.log(`⚡ Circuit breaker OPENED for domain: ${domain}. Will retry in ${this.config.circuitBreaker.cooldownDurationMs}ms`);
    
    this.emit('circuit-breaker-opened', {
      domain,
      cooldownMs: this.config.circuitBreaker.cooldownDurationMs,
      consecutiveFailures: queue.consecutiveFailures
    });
  }

  private updateCircuitBreakerState(domain: string, state: 'open' | 'half-open' | 'closed'): void {
    if (!this.domainStats.has(domain)) {
      this.domainStats.set(domain, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        circuitBreakerState: state
      });
    } else {
      const stats = this.domainStats.get(domain)!;
      stats.circuitBreakerState = state;
    }
  }

  private updateDomainStats(
    domain: string,
    success: boolean,
    responseTime: number,
    error?: string
  ): void {
    if (!this.domainStats.has(domain)) {
      this.domainStats.set(domain, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        circuitBreakerState: 'closed'
      });
    }
    
    const stats = this.domainStats.get(domain)!;
    stats.totalRequests++;
    
    if (success) {
      stats.successfulRequests++;
      // Update average response time
      stats.avgResponseTime = 
        (stats.avgResponseTime * (stats.successfulRequests - 1) + responseTime) / 
        stats.successfulRequests;
    } else {
      stats.failedRequests++;
      if (error) {
        stats.lastError = error;
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const httpClient = new ExternalHttpClient();

// Export for testing and custom instances
export default ExternalHttpClient;