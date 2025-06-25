import database from '../services/database';

export interface IClaim {
  id?: number;
  wallet_address: string;
  asset: string;
  amount: string;
  tx_hash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  claimed_at?: Date;
}

export interface ICooldown {
  wallet_address: string;
  asset: string;
  last_claim_at: Date;
}

export interface IAsset {
  symbol: string;
  name: string;
  amount: string;
  cooldown_hours: number;
  contract_address?: string;
  is_active: boolean;
}

export class ClaimModel {
  
  // Check if user can claim (cooldown check)
  async canClaim(walletAddress: string, asset: string): Promise<boolean> {
    try {
      const result = await database.query(
        `SELECT last_claim_at, cooldown_hours 
         FROM cooldowns c
         JOIN assets a ON c.asset = a.symbol 
         WHERE c.wallet_address = $1 AND c.asset = $2`,
        [walletAddress, asset]
      );

      if (result.rows.length === 0) {
        return true; // No previous claim
      }

      const { last_claim_at, cooldown_hours } = result.rows[0];
      const now = new Date();
      const lastClaim = new Date(last_claim_at);
      const cooldownMs = cooldown_hours * 60 * 60 * 1000;
      
      return (now.getTime() - lastClaim.getTime()) > cooldownMs;
    } catch (error) {
      console.error('Error checking cooldown:', error);
      throw error;
    }
  }

  // Get remaining cooldown time in milliseconds
  async getRemainingCooldown(walletAddress: string, asset: string): Promise<number> {
    try {
      const result = await database.query(
        `SELECT last_claim_at, cooldown_hours 
         FROM cooldowns c
         JOIN assets a ON c.asset = a.symbol 
         WHERE c.wallet_address = $1 AND c.asset = $2`,
        [walletAddress, asset]
      );

      if (result.rows.length === 0) {
        return 0;
      }

      const { last_claim_at, cooldown_hours } = result.rows[0];
      const now = new Date();
      const lastClaim = new Date(last_claim_at);
      const cooldownMs = cooldown_hours * 60 * 60 * 1000;
      const elapsed = now.getTime() - lastClaim.getTime();
      
      return Math.max(0, cooldownMs - elapsed);
    } catch (error) {
      console.error('Error getting remaining cooldown:', error);
      throw error;
    }
  }

  // Create a new claim
  async createClaim(claim: IClaim): Promise<IClaim> {
    try {
      const result = await database.query(
        `INSERT INTO claims (wallet_address, asset, amount, tx_hash, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [claim.wallet_address, claim.asset, claim.amount, claim.tx_hash, claim.status]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating claim:', error);
      throw error;
    }
  }

  // Update cooldown after successful claim
  async updateCooldown(walletAddress: string, asset: string): Promise<void> {
    try {
      await database.query(
        `INSERT INTO cooldowns (wallet_address, asset, last_claim_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (wallet_address, asset) 
         DO UPDATE SET last_claim_at = NOW()`,
        [walletAddress, asset]
      );
    } catch (error) {
      console.error('Error updating cooldown:', error);
      throw error;
    }
  }

  // Get user's claim history
  async getClaimHistory(walletAddress: string): Promise<IClaim[]> {
    try {
      const result = await database.query(
        `SELECT * FROM claims 
         WHERE wallet_address = $1 
         ORDER BY claimed_at DESC 
         LIMIT 50`,
        [walletAddress]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting claim history:', error);
      throw error;
    }
  }

  // Get asset information
  async getAsset(symbol: string): Promise<IAsset | null> {
    try {
      const result = await database.query(
        `SELECT * FROM assets WHERE symbol = $1 AND is_active = true`,
        [symbol]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting asset:', error);
      throw error;
    }
  }

  // Get all active assets
  async getAllAssets(): Promise<IAsset[]> {
    try {
      const result = await database.query(
        `SELECT * FROM assets WHERE is_active = true ORDER BY symbol`
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting assets:', error);
      throw error;
    }
  }

  // Update claim status (after blockchain confirmation)
  async updateClaimStatus(id: number, status: string, txHash?: string): Promise<void> {
    try {
      await database.query(
        `UPDATE claims SET status = $1, tx_hash = $2 WHERE id = $3`,
        [status, txHash, id]
      );
    } catch (error) {
      console.error('Error updating claim status:', error);
      throw error;
    }
  }
}

export default new ClaimModel();