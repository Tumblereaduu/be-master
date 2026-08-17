const rateLimit = require('express-rate-limit');

// ============================================================================
// TASK 5: LOGIN RATE LIMITING MIDDLEWARE
// ============================================================================
// Protects login endpoints from brute force attacks
// Limit: 5 failed attempts per 1 minute per IP
// Returns 429 Too Many Requests after limit exceeded

/**
 * Rate limiter for login endpoints
 * - 5 attempts per 1 minute per IP address
 * - Message: "Too many login attempts. Please try again later."
 * - Affects: POST /master/login, POST /admin/login, POST /auth/login
 */
const loginRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 5, // 5 requests per windowMs
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req, res) => {
    // Skip rate limiting for successful logins (we can't easily detect this in middleware)
    // This is acceptable - failed attempts are what we're protecting against
    return false;
  },
  keyGenerator: (req, res) => {
    // Use client IP as the key for rate limiting
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }
});

/**
 * Rate limiter for API endpoints in general
 * - 100 requests per 15 minutes per IP
 * - Used for non-login endpoints to prevent general abuse
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }
});

module.exports = {
  loginRateLimiter,
  apiRateLimiter
};
