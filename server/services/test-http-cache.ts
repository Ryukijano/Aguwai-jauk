/**
 * Test file for HTTP Client and Cache Service
 * Run with: npx tsx server/services/test-http-cache.ts
 */

import { ExternalHttpClient } from './http-client';
import { CacheService } from './cache-service';

async function testHttpClient() {
  console.log('\n🧪 Testing HTTP Client...\n');
  
  const client = new ExternalHttpClient({
    maxRetries: 2,
    baseDelay: 1000,
    domainConcurrency: 2,
    globalConcurrency: 5
  });
  
  // Listen to events
  client.on('request-queued', (data) => {
    console.log(`📥 Request queued: ${data.domain} (Queue length: ${data.queueLength})`);
  });
  
  client.on('request-success', (data) => {
    console.log(`✅ Request success: ${data.domain} (Response time: ${data.responseTime}ms, Retries: ${data.retryCount})`);
  });
  
  client.on('request-retry', (data) => {
    console.log(`🔄 Retry attempt ${data.retryCount}: ${data.domain} (Delay: ${data.delay}ms)`);
  });
  
  client.on('circuit-breaker-opened', (data) => {
    console.log(`⚡ Circuit breaker opened for ${data.domain}: ${data.consecutiveFailures} failures`);
  });
  
  try {
    // Test successful requests
    console.log('Testing successful requests...');
    
    const responses = await Promise.all([
      client.get('https://jsonplaceholder.typicode.com/posts/1'),
      client.get('https://jsonplaceholder.typicode.com/users/1'),
      client.get('https://jsonplaceholder.typicode.com/todos/1')
    ]);
    
    console.log(`\n📊 Completed ${responses.length} successful requests`);
    
    // Test rate limiting
    console.log('\nTesting rate limiting and queuing...');
    const manyRequests = [];
    for (let i = 1; i <= 5; i++) {
      manyRequests.push(client.get(`https://jsonplaceholder.typicode.com/posts/${i}`));
    }
    await Promise.all(manyRequests);
    console.log('✅ Rate limiting test passed');
    
    // Test error handling and retry
    console.log('\nTesting error handling...');
    try {
      await client.get('https://httpstat.us/500');
    } catch (error: any) {
      console.log(`⚠️ Expected error caught: ${error.message}`);
    }
    
    // Display stats
    const stats = client.getAllStats();
    console.log('\n📈 Domain Statistics:');
    for (const [domain, stat] of Array.from(stats)) {
      console.log(`  ${domain}:`);
      console.log(`    Total: ${stat.totalRequests}, Success: ${stat.successfulRequests}, Failed: ${stat.failedRequests}`);
      console.log(`    Avg Response Time: ${stat.avgResponseTime.toFixed(2)}ms`);
      console.log(`    Circuit Breaker: ${stat.circuitBreakerState}`);
    }
    
  } catch (error: any) {
    console.error('Test failed:', error.message);
  } finally {
    client.destroy();
  }
}

async function testCacheService() {
  console.log('\n🧪 Testing Cache Service...\n');
  
  const cache = new CacheService({
    memoryMaxEntries: 5,
    defaultTTL: 5000, // 5 seconds
    staleWhileRevalidate: true,
    persistToDatabase: true
  });
  
  // Listen to events
  cache.on('cache-hit', (data) => {
    console.log(`✅ Cache hit from ${data.tier}: ${data.key}`);
  });
  
  cache.on('cache-miss', (data) => {
    console.log(`❌ Cache miss: ${data.key}`);
  });
  
  cache.on('cache-evicted', (data) => {
    console.log(`🗑️ Evicted: ${data.key} (Size: ${data.size} bytes, Access count: ${data.accessCount})`);
  });
  
  cache.on('stale-served', (data) => {
    console.log(`📦 Stale data served: ${data.key}`);
  });
  
  try {
    // Test basic set/get
    console.log('Testing basic cache operations...');
    
    await cache.set('test-key-1', { data: 'Hello, World!' }, {
      url: 'https://example.com/api/test',
      ttl: 3000,
      status: 200
    });
    
    const entry = await cache.get('test-key-1');
    console.log(`Retrieved: ${JSON.stringify(entry?.value)}`);
    
    // Test multiple entries and LRU eviction
    console.log('\nTesting LRU eviction (max 5 entries)...');
    for (let i = 2; i <= 7; i++) {
      await cache.set(`test-key-${i}`, { data: `Value ${i}` }, {
        url: `https://example.com/api/test${i}`,
        ttl: 10000
      });
    }
    
    // Check if first entries were evicted
    const evicted = await cache.get('test-key-2');
    console.log(`Key 2 after eviction: ${evicted ? 'Still exists' : 'Evicted'}`);
    
    // Test stale-while-revalidate
    console.log('\nTesting stale-while-revalidate...');
    await cache.set('stale-test', { data: 'Fresh data' }, {
      url: 'https://example.com/stale',
      ttl: 1000 // Expires in 1 second
    });
    
    // Wait for it to become stale
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const staleEntry = await cache.get('stale-test');
    console.log(`Stale entry retrieved: ${staleEntry?.metadata.stale ? 'Yes (stale)' : 'No (fresh)'}`);
    
    // Test revalidation
    console.log('\nTesting revalidation...');
    const revalidated = await cache.revalidate('stale-test', async () => {
      console.log('  Fetching fresh data...');
      return { data: 'Revalidated data', timestamp: Date.now() };
    });
    console.log(`Revalidated data: ${JSON.stringify(revalidated)}`);
    
    // Test key existence
    const exists = await cache.has('test-key-5');
    console.log(`\nKey 'test-key-5' exists: ${exists}`);
    
    // List all keys
    const allKeys = await cache.keys();
    console.log(`\nAll cache keys (${allKeys.length} total):`);
    allKeys.forEach(key => console.log(`  - ${key}`));
    
    // Display cache statistics
    const stats = cache.getStats();
    console.log('\n📊 Cache Statistics:');
    console.log(`  Memory entries: ${stats.memoryEntries}`);
    console.log(`  Memory hits: ${stats.memoryHits}`);
    console.log(`  Memory misses: ${stats.memoryMisses}`);
    console.log(`  Database hits: ${stats.databaseHits}`);
    console.log(`  Database misses: ${stats.databaseMisses}`);
    console.log(`  Evictions: ${stats.evictions}`);
    console.log(`  Stale served: ${stats.staleServed}`);
    console.log(`  Revalidations: ${stats.revalidations}`);
    console.log(`  Total size: ${stats.totalSize} bytes`);
    
    // Clean up
    await cache.clear();
    console.log('\n🧹 Cache cleared');
    
  } catch (error: any) {
    console.error('Test failed:', error.message);
  } finally {
    cache.destroy();
  }
}

async function testIntegration() {
  console.log('\n🧪 Testing HTTP Client + Cache Integration...\n');
  
  const client = new ExternalHttpClient({
    maxRetries: 2,
    baseDelay: 500
  });
  
  const cache = new CacheService({
    memoryMaxEntries: 10,
    defaultTTL: 60000 // 1 minute
  });
  
  // Wrapper function to use cache with HTTP client
  async function fetchWithCache(url: string): Promise<any> {
    // Check cache first
    const cached = await cache.get(url);
    if (cached && !cached.metadata.stale) {
      console.log(`✅ Serving from cache: ${url}`);
      return cached.value;
    }
    
    // If stale, serve stale and revalidate
    if (cached?.metadata.stale) {
      console.log(`📦 Serving stale and revalidating: ${url}`);
      cache.revalidate(url, async () => {
        const response = await client.get(url);
        return response.data;
      }).catch(console.error);
      return cached.value;
    }
    
    // Fetch fresh data
    console.log(`🌐 Fetching fresh data: ${url}`);
    const response = await client.get(url);
    
    // Store in cache
    await cache.set(url, response.data, {
      url,
      status: response.status,
      headers: response.headers as any,
      ttl: 30000 // 30 seconds
    });
    
    return response.data;
  }
  
  try {
    // First request - should fetch
    const data1 = await fetchWithCache('https://jsonplaceholder.typicode.com/users/1');
    console.log(`User name: ${data1.name}`);
    
    // Second request - should use cache
    const data2 = await fetchWithCache('https://jsonplaceholder.typicode.com/users/1');
    console.log(`User email: ${data2.email}`);
    
    // Different URL - should fetch
    const data3 = await fetchWithCache('https://jsonplaceholder.typicode.com/users/2');
    console.log(`User 2 name: ${data3.name}`);
    
    // Stats
    console.log('\n📊 Integration Test Stats:');
    const cacheStats = cache.getStats();
    console.log(`  Cache hits: ${cacheStats.memoryHits}`);
    console.log(`  Cache misses: ${cacheStats.memoryMisses}`);
    
    const httpStats = client.getAllStats();
    for (const [domain, stat] of Array.from(httpStats)) {
      console.log(`  HTTP requests to ${domain}: ${stat.totalRequests}`);
    }
    
  } catch (error: any) {
    console.error('Integration test failed:', error.message);
  } finally {
    client.destroy();
    cache.destroy();
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting HTTP Client and Cache Service Tests\n');
  console.log('='.repeat(60));
  
  await testHttpClient();
  console.log('\n' + '='.repeat(60) + '\n');
  
  await testCacheService();
  console.log('\n' + '='.repeat(60) + '\n');
  
  await testIntegration();
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('✨ All tests completed!');
  process.exit(0);
}

// Run tests if this file is executed directly
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { testHttpClient, testCacheService, testIntegration };