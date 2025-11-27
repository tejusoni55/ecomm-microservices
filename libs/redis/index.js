// Redis client wrapper for caching and rate limiting
import Redis from 'ioredis';

let client = null;

/**
 * Get or create Redis client (singleton)
 * @returns {Promise<Redis>}
 */
export async function getRedis() {
  if (client && client.status === 'ready') {
    return client;
  }

  const redisUrl = process.env.REDIS_HOST || process.env.REDIS_URL || 'redis://localhost:6379';
  const redisPort = process.env.REDIS_PORT || 6379;
  
  client = new Redis({
    host: redisUrl,
    port: redisPort,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 10) {
        console.error('[Redis] Max reconnection attempts reached');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000);
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect on READONLY error
      }
      return false;
    },
  });

  client.on('error', (err) => {
    console.error('[Redis] Client error:', err);
  });

  client.on('connect', () => {
    console.log('[Redis] Client connected');
  });

  client.on('ready', () => {
    console.log('[Redis] Client ready');
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Client reconnecting...');
  });

  // Wait for connection to be ready
  if (client.status !== 'ready') {
    await new Promise((resolve, reject) => {
      if (client.status === 'ready') {
        resolve();
      } else {
        client.once('ready', resolve);
        client.once('error', reject);
      }
    });
  }

  return client;
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
  }
}

// ==================== CACHING UTILITIES ====================

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} - Cached value or null if not found
 */
export async function getCache(key) {
  try {
    const redis = await getRedis();
    const value = await redis.get(key);
    return value;
  } catch (error) {
    console.error(`[Redis] Error getting cache key "${key}":`, error);
    return null;
  }
}

/**
 * Get JSON value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Parsed JSON value or null if not found
 */
export async function getCacheJSON(key) {
  try {
    const value = await getCache(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`[Redis] Error parsing JSON for key "${key}":`, error);
    return null;
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {string} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function setCache(key, value, ttlSeconds = null) {
  try {
    const redis = await getRedis();
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
    return true;
  } catch (error) {
    console.error(`[Redis] Error setting cache key "${key}":`, error);
    return false;
  }
}

/**
 * Set JSON value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON stringified)
 * @param {number} ttlSeconds - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function setCacheJSON(key, value, ttlSeconds = null) {
  try {
    const jsonValue = JSON.stringify(value);
    return await setCache(key, jsonValue, ttlSeconds);
  } catch (error) {
    console.error(`[Redis] Error setting JSON cache key "${key}":`, error);
    return false;
  }
}

/**
 * Delete cache key
 * @param {string} key - Cache key to delete
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteCache(key) {
  try {
    const redis = await getRedis();
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[Redis] Error deleting cache key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all cache (use with caution!)
 * @returns {Promise<boolean>} - Success status
 */
export async function clearCache() {
  try {
    const redis = await getRedis();
    await redis.flushdb();
    return true;
  } catch (error) {
    console.error('[Redis] Error clearing cache:', error);
    return false;
  }
}

// ==================== RATE LIMITING UTILITIES ====================

/**
 * Check if rate limit is exceeded
 * @param {string} identifier - Unique identifier (e.g., userId, IP address)
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit(identifier, maxRequests, windowSeconds) {
  try {
    const redis = await getRedis();
    const key = `ratelimit:${identifier}`;
    const now = Date.now();

    // Get current count
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count, 10) : 0;

    if (currentCount >= maxRequests) {
      // Rate limit exceeded
      const ttl = await redis.ttl(key);
      const resetAt = now + (ttl * 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Increment counter
    if (currentCount === 0) {
      // First request in window, set with expiration
      await redis.setex(key, windowSeconds, '1');
    } else {
      // Increment existing counter
      await redis.incr(key);
    }

    const newCount = currentCount + 1;
    const ttl = await redis.ttl(key);
    const resetAt = now + (ttl * 1000);

    return {
      allowed: true,
      remaining: maxRequests - newCount,
      resetAt,
    };
  } catch (error) {
    console.error(`[Redis] Error checking rate limit for "${identifier}":`, error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: Date.now() + (windowSeconds * 1000),
    };
  }
}

/**
 * Reset rate limit for an identifier
 * @param {string} identifier - Unique identifier
 * @returns {Promise<boolean>} - Success status
 */
export async function resetRateLimit(identifier) {
  try {
    const redis = await getRedis();
    const key = `ratelimit:${identifier}`;
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[Redis] Error resetting rate limit for "${identifier}":`, error);
    return false;
  }
}

/**
 * Get rate limit status without incrementing
 * @param {string} identifier - Unique identifier
 * @param {number} maxRequests - Maximum number of requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{remaining: number, resetAt: number}>}
 */
export async function getRateLimitStatus(identifier, maxRequests, windowSeconds) {
  try {
    const redis = await getRedis();
    const key = `ratelimit:${identifier}`;
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count, 10) : 0;
    const ttl = await redis.ttl(key);
    const resetAt = ttl > 0 ? Date.now() + (ttl * 1000) : Date.now() + (windowSeconds * 1000);

    return {
      remaining: Math.max(0, maxRequests - currentCount),
      resetAt,
    };
  } catch (error) {
    console.error(`[Redis] Error getting rate limit status for "${identifier}":`, error);
    return {
      remaining: maxRequests,
      resetAt: Date.now() + (windowSeconds * 1000),
    };
  }
}

