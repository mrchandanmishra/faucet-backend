import { ethers } from 'ethers';
import config from '../config/config';

// ERC20 Token ABI (minimal interface for transfers)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.wallet = new ethers.Wallet(config.blockchain.privateKey, this.provider);
  }

  // Send native BONE tokens
  async sendBONE(toAddress: string, amount: string): Promise<string> {
    try {
      console.log(`🔄 Sending ${amount} BONE to ${toAddress}...`);

      const tx = await this.wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
        gasLimit: 21000n // Standard gas limit for ETH transfer
      });

      console.log(`✅ BONE transfer initiated. TX: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error('❌ BONE transfer failed:', error);
      throw error;
    }
  }

  // Send ERC20 tokens
  async sendToken(contractAddress: string, toAddress: string, amount: string, decimals: number = 18): Promise<string> {
    try {
      console.log(`🔄 Sending ${amount} tokens from ${contractAddress} to ${toAddress}...`);

      const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.wallet);
      
      // Convert amount to proper decimals
      const tokenAmount = ethers.parseUnits(amount, decimals);

      // Send the transaction
      const tx = await contract.transfer(toAddress, tokenAmount);
      
      console.log(`✅ Token transfer initiated. TX: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      console.error(`❌ Token transfer failed for ${contractAddress}:`, error);
      throw error;
    }
  }

  // Get token balance of faucet wallet
  async getTokenBalance(contractAddress: string): Promise<string> {
    try {
      if (contractAddress === 'native') {
        // Get BONE balance
        const balance = await this.provider.getBalance(this.wallet.address);
        return ethers.formatEther(balance);
      } else {
        // Get ERC20 token balance
        const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
        const balance = await contract.balanceOf(this.wallet.address);
        const decimals = await contract.decimals();
        return ethers.formatUnits(balance, decimals);
      }
    } catch (error) {
      console.error(`❌ Failed to get balance for ${contractAddress}:`, error);
      throw error;
    }
  }

  // Get transaction confirmation
  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<ethers.TransactionReceipt | null> {
    try {
      console.log(`🔄 Waiting for ${confirmations} confirmation(s) for TX: ${txHash}...`);
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      
      if (receipt) {
        console.log(`✅ Transaction confirmed: ${txHash}`);
      } else {
        console.log(`⚠️  Transaction not found: ${txHash}`);
      }
      
      return receipt;
    } catch (error) {
      console.error(`❌ Error waiting for transaction ${txHash}:`, error);
      throw error;
    }
  }

  // Validate wallet address
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  // Get current gas price
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || 0n;
    } catch (error) {
      console.error('❌ Failed to get gas price:', error);
      throw error;
    }
  }

  // Check if faucet has sufficient balance
  async checkSufficientBalance(asset: string, amount: string): Promise<boolean> {
    try {
      const contractAddress = this.getContractAddress(asset);
      const balance = await this.getTokenBalance(contractAddress);
      return parseFloat(balance) >= parseFloat(amount);
    } catch (error) {
      console.error(`❌ Error checking balance for ${asset}:`, error);
      return false;
    }
  }

  // Get contract address for asset
  private getContractAddress(asset: string): string {
    switch (asset.toUpperCase()) {
      case 'BONE': return 'native';
      case 'SHIB': return config.contracts.SHIB;
      case 'TREAT': return config.contracts.TREAT;
      case 'USDT': return config.contracts.USDT;
      case 'USDC': return config.contracts.USDC;
      case 'ETH': return config.contracts.ETH;
      default:
        throw new Error(`Unsupported asset: ${asset}`);
    }
  }

  // Main method to send any supported token
  async sendAsset(asset: string, toAddress: string, amount: string): Promise<string> {
    try {
      // Validate address
      if (!this.isValidAddress(toAddress)) {
        throw new Error('Invalid wallet address');
      }

      // Check balance
      const hasSufficientBalance = await this.checkSufficientBalance(asset, amount);
      if (!hasSufficientBalance) {
        throw new Error(`Insufficient ${asset} balance in faucet`);
      }

      // Send the asset
      if (asset.toUpperCase() === 'BONE') {
        return await this.sendBONE(toAddress, amount);
      } else {
        const contractAddress = this.getContractAddress(asset);
        return await this.sendToken(contractAddress, toAddress, amount);
      }
    } catch (error) {
      console.error(`❌ Failed to send ${asset}:`, error);
      throw error;
    }
  }

  // Get faucet wallet info
  getFaucetWalletAddress(): string {
    return this.wallet.address;
  }
}

export default new BlockchainService();