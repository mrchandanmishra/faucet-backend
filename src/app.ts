// src/app.ts - REPLACE in your BACKEND repo

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/config';

console.log('🔄 Loading faucet routes...');

// Import routes
import faucetRoutes from './routes/faucet';

console.log('✅ Faucet routes loaded successfully');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Updated to allow frontend connection
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : [
        'http://localhost:5173',   // Vite default
        'http://localhost:3000',   // React dev server
        'http://localhost:4173',   // Vite preview
        'http://127.0.0.1:5173',   // Alternative localhost
        'http://127.0.0.1:3000',
        'http://127.0.0.1:4173'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting (only in production)
if (config.nodeEnv === 'production') {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs, // 8 hours
    max: config.rateLimit.maxRequests,   // 5 requests per window
    message: {
      error: 'Too many requests from this IP, please try again later.',
      resetTime: Math.ceil(config.rateLimit.windowMs / 1000 / 60) + ' minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to all API routes
  app.use('/api/', limiter);
} else {
  console.log('⚠️  Rate limiting disabled in development mode');
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    network: 'Shibarium Puppynet'
  });
});

// API routes
app.use('/api/faucet', faucetRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /health',
      'POST /api/faucet/claim',
      'GET /api/faucet/status/:address',
      'GET /api/faucet/assets',
      'GET /api/faucet/info'
    ]
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  // Don't leak error details in production
  const isDev = config.nodeEnv === 'development';
  
  res.status(error.status || 500).json({
    error: 'Internal Server Error',
    message: isDev ? error.message : 'Something went wrong',
    ...(isDev && { stack: error.stack })
  });
});

export default app;