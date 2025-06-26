import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config/config';

// IP-based rate limiting (general protection)
export const ipRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs, // 8 hours
  max: config.rateLimit.maxRequests,   // 5 requests per 8 hours per IP
  message: {
    error: 'Too many requests from this IP address',
    message: 'You can only make 5 faucet requests per 8 hours',
    resetTime: new Date(Date.now() + config.rateLimit.windowMs).toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use real IP even behind proxies
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
});

// Wallet-based rate limiting (per wallet address)
export const walletRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs, // 8 hours  
  max: 5, // 5 requests per wallet per 8 hours (allows claiming different assets)
  message: {
    error: 'Too many requests from this wallet',
    message: 'Each wallet can only make 5 faucet requests per 8 hours',
    resetTime: new Date(Date.now() + config.rateLimit.windowMs).toISOString()
  },
  standardHeaders: false, // Don't expose wallet-based rate limit headers
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use wallet address from request body as the key
    const walletAddress = req.body?.walletAddress || req.params?.address;
    return walletAddress ? walletAddress.toLowerCase() : req.ip || 'unknown';
  },
  skip: (req: Request) => {
    // Skip rate limiting if no wallet address provided (will be caught by validation)
    return !req.body?.walletAddress && !req.params?.address;
  }
});

// Strict rate limiting for claim endpoint specifically
export const claimRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 3, // Only 3 claims per 30 minutes per IP (anti-spam)
  message: {
    error: 'Too many claim attempts',
    message: 'Please wait 30 minutes before trying again',
    resetTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Enhanced error handler for rate limiting
export const rateLimitErrorHandler = (req: Request, res: Response, next: any) => {
  // This runs when rate limit is exceeded
  if (res.headersSent) {
    return;
  }

  const retryAfter = res.getHeader('Retry-After');
  const resetTime = res.getHeader('X-RateLimit-Reset');
  
  res.status(429).json({
    error: 'Rate Limited',
    message: 'Too many requests. Please try again later.',
    retryAfter: retryAfter ? parseInt(retryAfter as string) : null,
    resetTime: resetTime ? new Date(parseInt(resetTime as string) * 1000).toISOString() : null,
    timestamp: new Date().toISOString()
  });
};