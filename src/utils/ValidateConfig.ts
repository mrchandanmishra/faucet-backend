import { ethers } from 'ethers';
import config from '../config/config';

async function validateConfig() {
  console.log('🔍 Validating configuration...\n');

  // 1. Check required environment variables
  const requiredVars = [
    'TESTNET_RPC_URL',
    'PRIVATE_KEY',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    return false;
  }

  console.log('✅ All required environment variables are set');

  // 2. Test blockchain connection
  try {
    console.log('🔄 Testing Shibarium Puppynet connection...');
    
    const provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    const network = await provider.getNetwork();
    
    console.log(`✅ Connected to Shibarium Puppynet (Chain ID: ${network.chainId})`);
    
    // 3. Test wallet
    console.log('🔄 Testing wallet connection...');
    
    const wallet = new ethers.Wallet(config.blockchain.privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    
    console.log(`✅ Wallet address: ${wallet.address}`);
    console.log(`✅ Wallet balance: ${ethers.formatEther(balance)} BONE`);
    
    if (parseFloat(ethers.formatEther(balance)) < 0.01) {
      console.warn('⚠️  Low wallet balance! You need at least 0.01 BONE for gas fees');
      console.warn('   Get test BONE from: https://faucet.shibarium.org/');
    }

    // 4. Test database connection
    console.log('🔄 Testing database connection...');
    const database = (await import('../services/database')).default;
    const dbConnected = await database.testConnection();
    
    if (dbConnected) {
      console.log('✅ Database connection successful');
    } else {
      console.error('❌ Database connection failed');
      return false;
    }

    console.log('\n🎉 Configuration validation complete!');
    console.log('📝 Summary:');
    console.log(`   - Network: Shibarium Puppynet`);
    console.log(`   - Wallet: ${wallet.address}`);
    console.log(`   - Balance: ${ethers.formatEther(balance)} BONE`);
    console.log(`   - Database: Connected`);
    
    return true;

  } catch (error) {
    console.error('❌ Blockchain connection failed:', error);
    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateConfig().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

export default validateConfig;