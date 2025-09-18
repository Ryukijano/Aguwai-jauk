import { EventEmitter } from 'events';
import crypto from 'crypto';
import { Pool } from 'pg';

// Types and interfaces
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: CacheMetadata;
}

export interface CacheMetadata {
  url: string;
  etag?: string;
  lastModified?: string;
  fetchedAt: number;
  expiresAt: number;
  ttl: number;
  status: number;
  attempts: number;
  headers?: Record<string, string>;
  stale?: boolean;
}

export interface CacheConfig {
  memoryMaxEntries?: number;
  defaultTTL?: number;
  staleWhileRevalidate?: boolean;
  staleIfErrorMs?: number;
  persistToDatabase?: boolean;
  cleanupIntervalMs?: number;
  maxCacheSize?: number; // Max size in bytes for memory cache
}

export interface CacheStats {
  memoryEntries: number;
  memoryHits: number;
  memoryMisses: number;
  databaseHits: number;
  databaseMisses: number;
  evictions: number;
  staleServed: number;
  revalidations: number;
  totalSize: number;
}

// LRU Node for memory cache
class LRUNode<T = any> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  size: number;
  prev: LRUNode<T> | null = null;
  next: LRUNode<T> | null = null;
  accessCount: number = 0;
  lastAccessed: number = Date.now();

  constructor(key: string, value: T, metadata: CacheMetadata) {
    this.key = key;
    this.value = value;
    this.metadata = metadata;
    this.size = this.calculateSize(value);
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1000; // Default size if serialization fails
    }
  }
}

// Default configuration
const DEFAULT_CONFIG: Required<CacheConfig> = {
  memoryMaxEntries: parseInt(process.env.CACHE_MEMORY_MAX_ENTRIES || '200'),
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL_MS || '3600000'), // 1 hour
  staleWhileRevalidate: process.env.CACHE_STALE_WHILE_REVALIDATE !== 'false',
  staleIfErrorMs: parseInt(process.env.CACHE_STALE_IF_ERROR_MS || '86400000'), // 24 hours
  persistToDatabase: process.env.CACHE_PERSIST_TO_DB !== 'false',
  cleanupIntervalMs: parseInt(process.env.CACHE_CLEANUP_INTERVAL_MS || '300000'), // 5 minutes
  maxCacheSize: parseInt(process.env.CACHE_MAX_SIZE_BYTES || '52428800') // 50MB
};

/**
 * Multi-tier caching service with LRU memory cache and persistent database storage
 * Implements stale-while-revalidate pattern for better performance
 */
export class CacheService extends EventEmitter {
  private config: Required<CacheConfig>;
  private memoryCache: Map<string, LRUNode> = new Map();
  private lruHead: LRUNode | null = null;
  private lruTail: LRUNode | null = null;
  private stats: CacheStats;
  private pool: Pool | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private revalidationQueue: Map<string, Promise<any>> = new Map();
  private currentCacheSize: number = 0;

  constructor(config: CacheConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.stats = {
      memoryEntries: 0,
      memoryHits: 0,
      memoryMisses: 0,
      databaseHits: 0,
      databaseMisses: 0,
      evictions: 0,
      staleServed: 0,
      revalidations: 0,
      totalSize: 0
    };

    // Initialize database connection if persistence is enabled
    if (this.config.persistToDatabase) {
      this.initializeDatabase();
    }

    // Start cleanup interval
    this.startCleanupInterval();

    console.log('🗄️ CacheService initialized with config:', {
      memoryMaxEntries: this.config.memoryMaxEntries,
      defaultTTL: this.config.defaultTTL,
      staleWhileRevalidate: this.config.staleWhileRevalidate,
      persistToDatabase: this.config.persistToDatabase
    });
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<CacheEntry<T> | null> {
    const normalizedKey = this.normalizeKey(key);
    
    // Check memory cache first
    const memoryEntry = this.getFromMemory<T>(normalizedKey);
    if (memoryEntry) {
      const isStale = this.isStale(memoryEntry.metadata);
      
      if (!isStale) {
        this.stats.memoryHits++;
        this.emit('cache-hit', { tier: 'memory', key: normalizedKey });
        return memoryEntry;
      }
      
      // If stale-while-revalidate is enabled and entry is stale but within error window
      if (this.config.staleWhileRevalidate && this.isWithinStaleWindow(memoryEntry.metadata)) {
        this.stats.staleServed++;
        this.emit('stale-served', { key: normalizedKey });
        
        // Mark as stale
        memoryEntry.metadata.stale = true;
        
        // Trigger revalidation in background if not already in progress
        if (!this.revalidationQueue.has(normalizedKey)) {
          this.emit('revalidation-triggered', { key: normalizedKey });
        }
        
        return memoryEntry;
      }
    }
    
    this.stats.memoryMisses++;
    
    // Check database if persistence is enabled
    if (this.config.persistToDatabase) {
      const dbEntry = await this.getFromDatabase<T>(normalizedKey);
      if (dbEntry) {
        const isStale = this.isStale(dbEntry.metadata);
        
        if (!isStale || this.isWithinStaleWindow(dbEntry.metadata)) {
          this.stats.databaseHits++;
          this.emit('cache-hit', { tier: 'database', key: normalizedKey });
          
          // Promote to memory cache
          this.setInMemory(normalizedKey, dbEntry.value, dbEntry.metadata);
          
          if (isStale) {
            dbEntry.metadata.stale = true;
            this.stats.staleServed++;
          }
          
          return dbEntry;
        }
      } else {
        this.stats.databaseMisses++;
      }
    }
    
    this.emit('cache-miss', { key: normalizedKey });
    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const now = Date.now();
    
    const fullMetadata: CacheMetadata = {
      url: metadata?.url || key,
      etag: metadata?.etag,
      lastModified: metadata?.lastModified,
      fetchedAt: metadata?.fetchedAt || now,
      ttl: metadata?.ttl || this.config.defaultTTL,
      expiresAt: metadata?.expiresAt || (now + (metadata?.ttl || this.config.defaultTTL)),
      status: metadata?.status || 200,
      attempts: metadata?.attempts || 1,
      headers: metadata?.headers,
      stale: false
    };
    
    // Set in memory cache
    this.setInMemory(normalizedKey, value, fullMetadata);
    
    // Set in database if persistence is enabled
    if (this.config.persistToDatabase) {
      await this.setInDatabase(normalizedKey, value, fullMetadata);
    }
    
    this.emit('cache-set', { key: normalizedKey, ttl: fullMetadata.ttl });
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    let deleted = false;
    
    // Delete from memory
    const node = this.memoryCache.get(normalizedKey);
    if (node) {
      this.removeNode(node);
      this.memoryCache.delete(normalizedKey);
      deleted = true;
    }
    
    // Delete from database
    if (this.config.persistToDatabase) {
      const dbDeleted = await this.deleteFromDatabase(normalizedKey);
      deleted = deleted || dbDeleted;
    }
    
    if (deleted) {
      this.emit('cache-delete', { key: normalizedKey });
    }
    
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.lruHead = null;
    this.lruTail = null;
    this.currentCacheSize = 0;
    this.stats.memoryEntries = 0;
    
    // Clear database cache
    if (this.config.persistToDatabase && this.pool) {
      await this.pool.query('DELETE FROM cache_entries');
    }
    
    this.emit('cache-cleared');
    console.log('🧹 Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats, totalSize: this.currentCacheSize };
  }

  /**
   * Trigger revalidation for a key
   */
  async revalidate(key: string, fetcher: () => Promise<any>): Promise<any> {
    const normalizedKey = this.normalizeKey(key);
    
    // Check if revalidation is already in progress
    if (this.revalidationQueue.has(normalizedKey)) {
      return this.revalidationQueue.get(normalizedKey);
    }
    
    const revalidationPromise = this.performRevalidation(normalizedKey, fetcher);
    this.revalidationQueue.set(normalizedKey, revalidationPromise);
    
    try {
      const result = await revalidationPromise;
      return result;
    } finally {
      this.revalidationQueue.delete(normalizedKey);
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    
    if (this.memoryCache.has(normalizedKey)) {
      return true;
    }
    
    if (this.config.persistToDatabase) {
      return this.existsInDatabase(normalizedKey);
    }
    
    return false;
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const memoryKeys = Array.from(this.memoryCache.keys());
    
    if (!this.config.persistToDatabase) {
      return pattern ? this.filterKeys(memoryKeys, pattern) : memoryKeys;
    }
    
    const dbKeys = await this.getKeysFromDatabase(pattern);
    const allKeys = new Set([...memoryKeys, ...dbKeys]);
    
    return Array.from(allKeys);
  }

  /**
   * Cleanup and destroy the cache service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as NodeJS.Timeout);
      this.cleanupInterval = null;
    }
    
    if (this.pool) {
      this.pool.end();
      this.pool = null;
    }
    
    this.memoryCache.clear();
    this.revalidationQueue.clear();
    this.removeAllListeners();
    
    console.log('💤 CacheService destroyed');
  }

  // Private methods

  private normalizeKey(key: string): string {
    // Normalize URL as cache key
    try {
      const url = new URL(key);
      // Sort query parameters for consistent keys
      const params = new URLSearchParams(url.searchParams);
      const sortedParams = new URLSearchParams(Array.from(params.entries()).sort());
      url.search = sortedParams.toString();
      return url.toString();
    } catch {
      // If not a valid URL, hash the key for consistency
      return crypto.createHash('sha256').update(key).digest('hex');
    }
  }

  private isStale(metadata: CacheMetadata): boolean {
    return Date.now() > metadata.expiresAt;
  }

  private isWithinStaleWindow(metadata: CacheMetadata): boolean {
    const staleAge = Date.now() - metadata.expiresAt;
    return staleAge < this.config.staleIfErrorMs;
  }

  private getFromMemory<T>(key: string): CacheEntry<T> | null {
    const node = this.memoryCache.get(key);
    if (!node) return null;
    
    // Move to head (most recently used)
    this.moveToHead(node);
    node.accessCount++;
    node.lastAccessed = Date.now();
    
    return {
      key: node.key,
      value: node.value as T,
      metadata: node.metadata
    };
  }

  private setInMemory<T>(key: string, value: T, metadata: CacheMetadata): void {
    // Check if key already exists
    if (this.memoryCache.has(key)) {
      const existingNode = this.memoryCache.get(key)!;
      this.currentCacheSize -= existingNode.size;
      this.removeNode(existingNode);
      this.memoryCache.delete(key);
    }
    
    // Create new node
    const node = new LRUNode(key, value, metadata);
    
    // Check size constraints
    while (this.shouldEvict(node)) {
      this.evictLRU();
    }
    
    // Add to cache
    this.memoryCache.set(key, node);
    this.addToHead(node);
    this.currentCacheSize += node.size;
    this.stats.memoryEntries = this.memoryCache.size;
  }

  private shouldEvict(newNode: LRUNode): boolean {
    // Check entry count limit
    if (this.memoryCache.size >= this.config.memoryMaxEntries) {
      return true;
    }
    
    // Check size limit
    if (this.currentCacheSize + newNode.size > this.config.maxCacheSize) {
      return true;
    }
    
    return false;
  }

  private evictLRU(): void {
    if (!this.lruTail) return;
    
    const node = this.lruTail;
    this.removeNode(node);
    this.memoryCache.delete(node.key);
    this.currentCacheSize -= node.size;
    this.stats.evictions++;
    
    this.emit('cache-evicted', { 
      key: node.key, 
      size: node.size,
      accessCount: node.accessCount 
    });
  }

  private addToHead(node: LRUNode): void {
    node.prev = null;
    node.next = this.lruHead;
    
    if (this.lruHead) {
      this.lruHead.prev = node;
    }
    
    this.lruHead = node;
    
    if (!this.lruTail) {
      this.lruTail = node;
    }
  }

  private removeNode(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.lruHead = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.lruTail = node.prev;
    }
  }

  private moveToHead(node: LRUNode): void {
    if (node === this.lruHead) return;
    
    this.removeNode(node);
    this.addToHead(node);
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      // Create cache table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cache_entries (
          key VARCHAR(512) PRIMARY KEY,
          value JSONB NOT NULL,
          metadata JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          access_count INTEGER DEFAULT 1
        )
      `);
      
      // Create indexes
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
        ON cache_entries (CAST(metadata->>'expiresAt' AS BIGINT))
      `);
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cache_accessed_at 
        ON cache_entries (accessed_at)
      `);
      
      console.log('✅ Cache database initialized');
    } catch (error) {
      console.error('Failed to initialize cache database:', error);
      this.config.persistToDatabase = false;
    }
  }

  private async getFromDatabase<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.pool) return null;
    
    try {
      const result = await this.pool.query(
        `UPDATE cache_entries 
         SET accessed_at = CURRENT_TIMESTAMP, 
             access_count = access_count + 1
         WHERE key = $1
         RETURNING value, metadata`,
        [key]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        key,
        value: row.value as T,
        metadata: row.metadata as CacheMetadata
      };
    } catch (error) {
      console.error('Error getting from database cache:', error);
      return null;
    }
  }

  private async setInDatabase<T>(key: string, value: T, metadata: CacheMetadata): Promise<void> {
    if (!this.pool) return;
    
    try {
      await this.pool.query(
        `INSERT INTO cache_entries (key, value, metadata)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) 
         DO UPDATE SET 
           value = EXCLUDED.value,
           metadata = EXCLUDED.metadata,
           accessed_at = CURRENT_TIMESTAMP,
           access_count = cache_entries.access_count + 1`,
        [key, JSON.stringify(value), JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error('Error setting in database cache:', error);
    }
  }

  private async deleteFromDatabase(key: string): Promise<boolean> {
    if (!this.pool) return false;
    
    try {
      const result = await this.pool.query(
        'DELETE FROM cache_entries WHERE key = $1',
        [key]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting from database cache:', error);
      return false;
    }
  }

  private async existsInDatabase(key: string): Promise<boolean> {
    if (!this.pool) return false;
    
    try {
      const result = await this.pool.query(
        'SELECT 1 FROM cache_entries WHERE key = $1 LIMIT 1',
        [key]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking existence in database:', error);
      return false;
    }
  }

  private async getKeysFromDatabase(pattern?: string): Promise<string[]> {
    if (!this.pool) return [];
    
    try {
      let query = 'SELECT key FROM cache_entries';
      const params: any[] = [];
      
      if (pattern) {
        query += ' WHERE key LIKE $1';
        params.push(pattern.replace(/\*/g, '%'));
      }
      
      const result = await this.pool.query(query, params);
      return result.rows.map(row => row.key);
    } catch (error) {
      console.error('Error getting keys from database:', error);
      return [];
    }
  }

  private filterKeys(keys: string[], pattern: string): string[] {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  private async performRevalidation(key: string, fetcher: () => Promise<any>): Promise<any> {
    this.stats.revalidations++;
    
    try {
      const result = await fetcher();
      
      // Update cache with fresh data
      await this.set(key, result, {
        fetchedAt: Date.now(),
        attempts: 1,
        stale: false
      });
      
      this.emit('revalidation-success', { key });
      return result;
      
    } catch (error) {
      this.emit('revalidation-failed', { key, error: (error as Error).message });
      
      // Return stale data if available
      const staleEntry = await this.get(key);
      if (staleEntry) {
        return staleEntry.value;
      }
      
      throw error;
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs) as NodeJS.Timeout;
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean memory cache
    for (const [key, node] of Array.from(this.memoryCache)) {
      if (now > node.metadata.expiresAt + this.config.staleIfErrorMs) {
        this.memoryCache.delete(key);
        this.currentCacheSize -= node.size;
        cleaned++;
      }
    }
    
    // Clean database cache
    if (this.config.persistToDatabase && this.pool) {
      try {
        const result = await this.pool.query(
          `DELETE FROM cache_entries 
           WHERE CAST(metadata->>'expiresAt' AS BIGINT) < $1`,
          [now - this.config.staleIfErrorMs]
        );
        cleaned += result.rowCount ?? 0;
      } catch (error) {
        console.error('Error cleaning database cache:', error);
      }
    }
    
    if (cleaned > 0) {
      this.stats.memoryEntries = this.memoryCache.size;
      this.emit('cache-cleanup', { entriesCleaned: cleaned });
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired entries`);
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export for testing and custom instances
export default CacheService;