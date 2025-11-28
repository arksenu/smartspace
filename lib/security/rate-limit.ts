import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create a random fallback for development if env vars are missing
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://example.com',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'example_token',
});

// Create different rate limiters
export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

export const chatRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 chat messages per minute
  analytics: true,
});

export const uploadRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 uploads per hour
  analytics: true,
});
