// Express middleware for rate limiting using Redis
import { checkRateLimit } from './index.js';

/**
 * Rate limiting middleware for Express
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Maximum requests allowed
 * @param {number} options.windowSeconds - Time window in seconds
 * @param {Function} options.getIdentifier - Function to get unique identifier from request (default: uses IP)
 * @param {Function} options.onLimitExceeded - Optional callback when limit is exceeded
 * @returns {Function} Express middleware
 */
export function rateLimitMiddleware(options = {}) {
  const {
    maxRequests = 100,
    windowSeconds = 60,
    getIdentifier = (req) => req.ip || req.socket.remoteAddress || 'unknown',
    onLimitExceeded = null,
  } = options;

  return async (req, res, next) => {
    try {
      const identifier = getIdentifier(req);
      const result = await checkRateLimit(identifier, maxRequests, windowSeconds);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

      if (!result.allowed) {
        if (onLimitExceeded) {
          onLimitExceeded(req, res, result);
        } else {
          res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again after a minute`,
            resetAt: result.resetAt,
          });
        }
        return;
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Middleware error:', error);
      // On error, allow the request (fail open)
      next();
    }
  };
}

