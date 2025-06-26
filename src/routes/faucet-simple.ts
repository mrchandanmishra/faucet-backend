import express, { Request, Response } from 'express';

const router = express.Router();

// Simple test endpoint
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Faucet API is working!',
    timestamp: new Date().toISOString()
  });
});

// Basic claim endpoint (simplified)
router.post('/claim', (req: Request, res: Response) => {
  const { walletAddress, asset } = req.body;
  
  if (!walletAddress || !asset) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'walletAddress and asset are required'
    });
  }
  
  // For now, just return a success message
  res.json({
    success: true,
    message: `Claim request received for ${asset}`,
    data: {
      walletAddress,
      asset,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;