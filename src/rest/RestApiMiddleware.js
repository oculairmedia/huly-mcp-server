/**
 * RestApiMiddleware - Middleware for REST API
 *
 * Provides error handling, logging, and other middleware for REST endpoints
 */

import cors from 'cors';
import { randomUUID } from 'crypto';

export class RestApiMiddleware {
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  /**
   * CORS handler middleware
   * @returns {Function} Express middleware
   */
  corsHandler() {
    return cors({
      origin: ['http://localhost', 'http://127.0.0.1', 'http://192.168.50.90'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    });
  }

  /**
   * Request logging middleware
   * @returns {Function} Express middleware
   */
  requestLogger() {
    return (req, res, next) => {
      const requestId = randomUUID();
      const startTime = Date.now();

      // Add request ID to request object
      req.requestId = requestId;

      // Add request ID to response headers
      res.setHeader('X-Request-ID', requestId);

      // Log incoming request
      this.logger.info('REST API Request', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length'),
        timestamp: new Date().toISOString(),
      });

      // Override res.json to log response
      const originalJson = res.json;
      res.json = function(data) {
        const responseTime = Date.now() - startTime;

        // Log response
        req.app.locals.logger?.info('REST API Response', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime,
          success: data.success !== false,
          timestamp: new Date().toISOString(),
        });

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Error handling middleware
   * @returns {Function} Express middleware
   */
  errorHandler() {
    return (error, req, res, _next) => {
      const requestId = req.requestId || 'unknown';

      // Log error
      this.logger.error('REST API Error', {
        requestId,
        method: req.method,
        url: req.url,
        error: error.message,
        stack: error.stack,
        code: error.code,
        timestamp: new Date().toISOString(),
      });

      // Determine status code
      let statusCode = 500;
      if (error.statusCode) {
        statusCode = error.statusCode;
      } else if (error.code === 'TOOL_NOT_FOUND') {
        statusCode = 404;
      } else if (error.code === 'VALIDATION_ERROR') {
        statusCode = 400;
      } else if (error.code === 'HULY_API_ERROR') {
        statusCode = 502;
      }

      // Build error response
      const errorResponse = {
        success: false,
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: this.sanitizeErrorMessage(error.message),
          ...(error.details && { details: error.details }),
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      // Send error response
      res.status(statusCode).json(errorResponse);
    };
  }

  /**
   * Sanitize error message to prevent information leakage
   * @param {string} message - Original error message
   * @returns {string} Sanitized message
   */
  sanitizeErrorMessage(message) {
    if (!message) return 'An error occurred';

    // Remove sensitive patterns
    const sanitized = message
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/secret[=:]\s*\S+/gi, 'secret=***');

    return sanitized;
  }

  /**
   * Request size validation middleware
   * @param {number} maxSize - Maximum request size in bytes
   * @returns {Function} Express middleware
   */
  requestSizeValidator(maxSize = 10 * 1024 * 1024) { // 10MB default
    return (req, res, next) => {
      const contentLength = req.get('Content-Length');

      if (contentLength && parseInt(contentLength) > maxSize) {
        const error = new Error(`Request size exceeds limit of ${maxSize} bytes`);
        error.code = 'REQUEST_TOO_LARGE';
        error.statusCode = 413;
        return next(error);
      }

      next();
    };
  }

  /**
   * Rate limiting middleware (simple in-memory implementation)
   * @param {Object} options - Rate limiting options
   * @returns {Function} Express middleware
   */
  rateLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // Max requests per window
      message = 'Too many requests, please try again later',
    } = options;

    const requests = new Map();

    return (req, res, next) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [id, timestamps] of requests.entries()) {
        const filtered = timestamps.filter(time => time > windowStart);
        if (filtered.length === 0) {
          requests.delete(id);
        } else {
          requests.set(id, filtered);
        }
      }

      // Check current client
      const clientRequests = requests.get(clientId) || [];
      const recentRequests = clientRequests.filter(time => time > windowStart);

      if (recentRequests.length >= max) {
        const error = new Error(message);
        error.code = 'RATE_LIMIT_EXCEEDED';
        error.statusCode = 429;
        return next(error);
      }

      // Add current request
      recentRequests.push(now);
      requests.set(clientId, recentRequests);

      next();
    };
  }

  /**
   * Security headers middleware
   * @returns {Function} Express middleware
   */
  securityHeaders() {
    return (req, res, next) => {
      // Prevent XSS attacks
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // HTTPS enforcement (only in production)
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }

      // Content Security Policy
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      );

      next();
    };
  }
}