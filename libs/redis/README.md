# @ecomm/redis

Redis client wrapper for caching and rate limiting in the ecomm-microservices project.

## Features

- **Caching**: Simple get/set/delete operations with TTL support
- **Rate Limiting**: Token bucket algorithm implementation
- **Express Middleware**: Ready-to-use rate limiting middleware

## Installation

The library is automatically available in the workspace. Redis must be running (via `docker compose up`).

## Usage

### Basic Connection

```javascript
import { getRedis, closeRedis } from '@ecomm/redis';

// Get Redis client (auto-connects)
const redis = await getRedis();

// Close connection (usually on app shutdown)
await closeRedis();
```

### Caching

```javascript
import { 
  getCache, 
  setCache, 
  getCacheJSON, 
  setCacheJSON, 
  deleteCache 
} from '@ecomm/redis';

// Simple string cache
await setCache('user:123', 'John Doe', 3600); // TTL: 1 hour
const user = await getCache('user:123');

// JSON cache
await setCacheJSON('product:456', { name: 'Laptop', price: 999 }, 1800);
const product = await getCacheJSON('product:456');

// Delete cache
await deleteCache('user:123');
```

### Rate Limiting

```javascript
import { checkRateLimit, resetRateLimit } from '@ecomm/redis';

// Check rate limit (100 requests per 60 seconds)
const result = await checkRateLimit('user:123', 100, 60);

if (result.allowed) {
  // Process request
  console.log(`Remaining: ${result.remaining}`);
} else {
  // Rate limit exceeded
  console.log(`Reset at: ${new Date(result.resetAt).toISOString()}`);
}

// Reset rate limit
await resetRateLimit('user:123');
```

### Express Middleware

```javascript
import express from 'express';
import { rateLimitMiddleware } from '@ecomm/redis/middleware';

const app = express();

// Global rate limit: 100 requests per minute per IP
app.use(rateLimitMiddleware({
  maxRequests: 100,
  windowSeconds: 60,
}));

// Custom identifier (e.g., by user ID)
app.use('/api/products', rateLimitMiddleware({
  maxRequests: 50,
  windowSeconds: 60,
  getIdentifier: (req) => req.user?.id || req.ip,
}));

// Custom error handler
app.use('/api/orders', rateLimitMiddleware({
  maxRequests: 10,
  windowSeconds: 60,
  onLimitExceeded: (req, res, result) => {
    res.status(429).json({
      error: 'Order rate limit exceeded',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    });
  },
}));
```

## Environment Variables

- `REDIS_URL` - Redis connection URL (default: `redis://localhost:6379`)

## API Reference

### Caching Functions

- `getCache(key)` - Get string value from cache
- `getCacheJSON(key)` - Get and parse JSON value from cache
- `setCache(key, value, ttlSeconds?)` - Set string value in cache
- `setCacheJSON(key, value, ttlSeconds?)` - Set JSON value in cache
- `deleteCache(key)` - Delete cache key
- `clearCache()` - Clear all cache (use with caution!)

### Rate Limiting Functions

- `checkRateLimit(identifier, maxRequests, windowSeconds)` - Check and increment rate limit
- `resetRateLimit(identifier)` - Reset rate limit for identifier
- `getRateLimitStatus(identifier, maxRequests, windowSeconds)` - Get status without incrementing

### Connection Functions

- `getRedis()` - Get or create Redis client
- `closeRedis()` - Close Redis connection

## Examples

### Cache Product Data

```javascript
import { getCacheJSON, setCacheJSON } from '@ecomm/redis';

async function getProduct(productId) {
  // Try cache first
  const cached = await getCacheJSON(`product:${productId}`);
  if (cached) return cached;

  // Fetch from database
  const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);

  // Cache for 1 hour
  await setCacheJSON(`product:${productId}`, product, 3600);

  return product;
}
```

### Rate Limit by User

```javascript
import { checkRateLimit } from '@ecomm/redis';

async function createOrder(req, res) {
  const userId = req.user.id;
  const limit = await checkRateLimit(`order:${userId}`, 10, 3600); // 10 orders per hour

  if (!limit.allowed) {
    return res.status(429).json({
      error: 'Too many orders',
      resetAt: limit.resetAt,
    });
  }

  // Process order...
}
```

