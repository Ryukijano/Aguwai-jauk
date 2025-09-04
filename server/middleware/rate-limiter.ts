import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { Request, Response } from 'express';

// Redis client for rate limiting (optional, falls back to memory if not available)
let redisClient: any = null;

// Initialize Redis connection
async function initRedis() {
  try {
    if (process.env.REDIS_URL) {
      redisClient = createClient({
        url: process.env.REDIS_URL
      });

      redisClient.on('error', (err: any) => {
        console.error('Redis Client Error:', err);
        redisClient = null;
      });

      await redisClient.connect();
      console.log('✅ Redis connected for rate limiting');
    }
  } catch (error) {
    console.warn('Redis not available, using memory store for rate limiting');
    redisClient = null;
  }
}

// Initialize Redis on module load
initRedis().catch(console.error);

// Different rate limit configurations for different endpoints
export const rateLimitConfigs = {
  // Strict limit for AI agent endpoints (expensive operations)
  aiAgent: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many AI requests, please try again after a minute.',
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: 'rl:ai:',
    }) : undefined,
    keyGenerator: (req: Request, res: Response) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      if (req.user) {
        return `user:${(req.user as any).id}`;
      }
      // Use the built-in IP address handling for proper IPv6 support
      return req.ip?.replace(/:\d+[^:]*$/, '') || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'You have exceeded the AI agent request limit. Please wait before trying again.',
        retryAfter: 60
      });
    }
  }),

  // Moderate limit for search operations
  search: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    message: 'Too many search requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: 'rl:search:',
    }) : undefined,
    keyGenerator: (req: Request, res: Response) => {
      if (req.user) {
        return `user:${(req.user as any).id}`;
      }
      return req.ip?.replace(/:\d+[^:]*$/, '') || 'unknown';
    }
  }),

  // General API rate limit
  api: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: 'rl:api:',
    }) : undefined,
    keyGenerator: (req: Request, res: Response) => {
      if (req.user) {
        return `user:${(req.user as any).id}`;
      }
      return req.ip?.replace(/:\d+[^:]*$/, '') || 'unknown';
    }
  }),

  // Strict limit for auth endpoints (prevent brute force)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: 'rl:auth:',
    }) : undefined,
    keyGenerator: (req: Request, res: Response) => {
      // Rate limit by email/username for auth attempts
      const identifier = req.body?.email || req.body?.username || req.ip?.replace(/:\d+[^:]*$/, '') || 'unknown';
      return `auth:${identifier}`;
    }
  }),

  // File upload rate limit
  upload: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // 10 uploads per 10 minutes
    message: 'Too many file uploads, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: 'rl:upload:',
    }) : undefined,
    keyGenerator: (req: Request, res: Response) => {
      if (req.user) {
        return `user:${(req.user as any).id}`;
      }
      return req.ip?.replace(/:\d+[^:]*$/, '') || 'unknown';
    }
  })
};

// Dynamic rate limiter based on user tier (for future premium features)
export function createDynamicRateLimiter(tierLimits: { free: number; premium: number; enterprise: number }) {
  return rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: (req: Request) => {
      // Check user tier from request (implement user tier logic)
      const userTier = (req.user as any)?.tier || 'free';
      return tierLimits[userTier as keyof typeof tierLimits] || tierLimits.free;
    },
    message: 'Rate limit exceeded for your account tier.',
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
      client: redisClient,
      prefix: 'rl:dynamic:',
    }) : undefined,
    keyGenerator: (req: Request, res: Response) => {
      if (req.user) {
        return `user:${(req.user as any).id}`;
      }
      return req.ip?.replace(/:\d+[^:]*$/, '') || 'unknown';
    }
  });
}

// Middleware to track API usage statistics
export async function trackApiUsage(req: Request, res: Response, next: any) {
  const startTime = Date.now();
  
  // Track response time
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    const endpoint = req.path;
    const method = req.method;
    const statusCode = res.statusCode;
    const userId = (req.user as any)?.id || 'anonymous';
    
    // Log usage statistics (can be sent to analytics service)
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({
        type: 'api_usage',
        userId,
        endpoint,
        method,
        statusCode,
        duration,
        timestamp: new Date().toISOString()
      }));
    }
    
    // Store in Redis for analytics if available
    if (redisClient) {
      try {
        const key = `stats:${userId}:${new Date().toISOString().split('T')[0]}`;
        await redisClient.hIncrBy(key, `${method}:${endpoint}`, 1);
        await redisClient.expire(key, 7 * 24 * 60 * 60); // Keep for 7 days
      } catch (error) {
        // Silently fail, don't block the request
      }
    }
  });
  
  next();
}

// Get current rate limit status for a user
export async function getRateLimitStatus(userId: string, limiterType: string = 'ai'): Promise<any> {
  if (!redisClient) {
    return { available: true, message: 'Rate limiting using memory store' };
  }
  
  try {
    const key = `rl:${limiterType}:user:${userId}`;
    const count = await redisClient.get(key);
    const ttl = await redisClient.ttl(key);
    
    const limits = {
      ai: 10,
      search: 30,
      api: 100
    };
    
    const limit = limits[limiterType as keyof typeof limits] || 100;
    const used = parseInt(count || '0');
    const remaining = Math.max(0, limit - used);
    
    return {
      limit,
      used,
      remaining,
      resetIn: ttl > 0 ? ttl : 0,
      percentage: (used / limit) * 100
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return { error: 'Unable to fetch rate limit status' };
  }
}

export default rateLimitConfigs;