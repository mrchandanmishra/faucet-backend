import express, { Request, Response } from 'express';
import ClaimModel from '../models/Claim';
import blockchainService from '../services/blockchain';

const router = express.Router();

// Helper function to validate wallet address
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to format remaining time
const formatRemainingTime = (ms: number): string => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

// GET /api/faucet/test - Test endpoint
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Faucet API is working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /api/faucet/claim': 'Claim tokens',
      'GET /api/faucet/status/:address': 'Check cooldowns',
      'GET /api/faucet/assets': 'Get supported assets',
      'GET /api/faucet/info': 'Get faucet info'
    }
  });
});

// POST /api/faucet/claim - Main claim endpoint
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { walletAddress, asset } = req.body;

    // Basic validation
    if (!walletAddress || !asset) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'walletAddress and asset are required'
      });
    }

    if (!isValidAddress(walletAddress)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid wallet address format'
      });
    }

    const supportedAssets = ['BONE', 'SHIB', 'TREAT', 'USDT', 'USDC', 'ETH'];
    if (!supportedAssets.includes(asset.toUpperCase())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid asset. Must be one of: ${supportedAssets.join(', ')}`
      });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const normalizedAsset = asset.toUpperCase();

    console.log(`🔄 Claim request: ${normalizedAsset} for ${normalizedAddress}`);

    // 1. Check if asset exists and is active
    const assetInfo = await ClaimModel.getAsset(normalizedAsset);
    if (!assetInfo) {
      return res.status(400).json({
        error: 'Invalid Asset',
        message: `Asset ${normalizedAsset} is not supported or currently inactive`
      });
    }

    // 2. Check cooldown period
    const canClaim = await ClaimModel.canClaim(normalizedAddress, normalizedAsset);
    if (!canClaim) {
      const remainingCooldown = await ClaimModel.getRemainingCooldown(normalizedAddress, normalizedAsset);
      return res.status(429).json({
        error: 'Cooldown Active',
        message: `Please wait ${formatRemainingTime(remainingCooldown)} before claiming ${normalizedAsset} again`,
        remainingTime: remainingCooldown,
        canClaimAt: new Date(Date.now() + remainingCooldown).toISOString()
      });
    }

    // 3. Check faucet balance
    const hasSufficientBalance = await blockchainService.checkSufficientBalance(normalizedAsset, assetInfo.amount);
    if (!hasSufficientBalance) {
      return res.status(503).json({
        error: 'Insufficient Faucet Balance',
        message: `Faucet does not have enough ${normalizedAsset}. Please try again later.`
      });
    }

    // 4. Create pending claim record
    const pendingClaim = await ClaimModel.createClaim({
      wallet_address: normalizedAddress,
      asset: normalizedAsset,
      amount: assetInfo.amount,
      status: 'pending'
    });

    // 5. Send the transaction
    let txHash: string;
    try {
      txHash = await blockchainService.sendAsset(normalizedAsset, walletAddress, assetInfo.amount);
      
      // Update claim with transaction hash
      await ClaimModel.updateClaimStatus(pendingClaim.id!, 'confirmed', txHash);
      
      // Update cooldown
      await ClaimModel.updateCooldown(normalizedAddress, normalizedAsset);

      console.log(`✅ Claim successful: ${assetInfo.amount} ${normalizedAsset} sent to ${normalizedAddress}`);

    } catch (blockchainError) {
      console.error('❌ Blockchain transaction failed:', blockchainError);
      
      // Update claim status to failed
      await ClaimModel.updateClaimStatus(pendingClaim.id!, 'failed');
      
      return res.status(500).json({
        error: 'Transaction Failed',
        message: 'Failed to send transaction to blockchain. Please try again later.',
        claimId: pendingClaim.id
      });
    }

    // 6. Return success response
    res.status(200).json({
      success: true,
      message: `Successfully claimed ${assetInfo.amount} ${normalizedAsset}!`,
      data: {
        asset: normalizedAsset,
        amount: assetInfo.amount,
        walletAddress: normalizedAddress,
        transactionHash: txHash,
        claimId: pendingClaim.id,
        timestamp: new Date().toISOString(),
        nextClaimAt: new Date(Date.now() + (assetInfo.cooldown_hours * 60 * 60 * 1000)).toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Claim endpoint error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// GET /api/faucet/status/:address - Check claim status and cooldowns
router.get('/status/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid wallet address format'
      });
    }

    const normalizedAddress = address.toLowerCase();

    // Get all supported assets
    const supportedAssets = await ClaimModel.getAllAssets();
    
    // Check cooldown status for each asset
    const assetStatus = await Promise.all(
      supportedAssets.map(async (asset) => {
        const canClaim = await ClaimModel.canClaim(normalizedAddress, asset.symbol);
        const remainingCooldown = canClaim ? 0 : await ClaimModel.getRemainingCooldown(normalizedAddress, asset.symbol);
        
        return {
          asset: asset.symbol,
          name: asset.name,
          amount: asset.amount,
          cooldownHours: asset.cooldown_hours,
          canClaim: canClaim,
          remainingCooldown: remainingCooldown,
          remainingTime: remainingCooldown > 0 ? formatRemainingTime(remainingCooldown) : null,
          nextClaimAt: remainingCooldown > 0 ? new Date(Date.now() + remainingCooldown).toISOString() : null
        };
      })
    );

    // Get recent claim history
    const recentClaims = await ClaimModel.getClaimHistory(normalizedAddress);

    res.status(200).json({
      success: true,
      data: {
        walletAddress: normalizedAddress,
        assets: assetStatus,
        recentClaims: recentClaims.slice(0, 10), // Last 10 claims
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Status endpoint error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// GET /api/faucet/assets - Get all supported assets
router.get('/assets', async (req: Request, res: Response) => {
  try {
    const assets = await ClaimModel.getAllAssets();
    
    res.status(200).json({
      success: true,
      data: {
        supportedAssets: assets,
        network: 'Shibarium Puppynet',
        chainId: 157,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Assets endpoint error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch supported assets'
    });
  }
});

// GET /api/faucet/info - Get faucet information
router.get('/info', async (req: Request, res: Response) => {
  try {
    const faucetAddress = blockchainService.getFaucetWalletAddress();
    
    // Get balances for all supported assets
    const assets = await ClaimModel.getAllAssets();
    const balances = await Promise.all(
      assets.map(async (asset) => {
        try {
          const contractAddress = asset.contract_address;
          const balance = await blockchainService.getTokenBalance(contractAddress || 'native');
          return {
            asset: asset.symbol,
            balance: balance,
            contractAddress: contractAddress
          };
        } catch (error) {
          return {
            asset: asset.symbol,
            balance: 'Error',
            contractAddress: asset.contract_address
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: {
        faucetAddress: faucetAddress,
        network: 'Shibarium Puppynet',
        chainId: 157,
        balances: balances,
        cooldownPeriod: '8 hours',
        maxRequestsPerPeriod: 5,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Info endpoint error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch faucet information'
    });
  }
});

export default router;