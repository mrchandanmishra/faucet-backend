import app from './app';
import config from './config/config';
import database from './services/database';
import blockchainService from './services/blockchain';

async function startServer() {
  try {
    console.log('🚀 Starting Faucet Backend Server...\n');

    // 1. Test database connection
    console.log('🔄 Testing database connection...');
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // 2. Set up database tables (if not exists)
    console.log('🔄 Setting up database tables...');
    await database.createTables();
    await database.seedAssets();

    // 3. Test blockchain connection
    console.log('🔄 Testing blockchain connection...');
    const faucetAddress = blockchainService.getFaucetWalletAddress();
    console.log(`✅ Faucet wallet: ${faucetAddress}`);

    // 4. Start the Express server
    const server = app.listen(config.port, () => {
      console.log('\n🎉 Faucet Backend Server Started Successfully!');
      console.log(`📍 Server running on: http://localhost:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`🏦 Network: Shibarium Puppynet`);
      console.log(`💰 Faucet Address: ${faucetAddress}`);
      console.log('\n📋 Available Endpoints:');
      console.log('   GET  /health                    - Health check');
      console.log('   GET  /api/faucet/test           - Test endpoint');
      console.log('   POST /api/faucet/claim          - Claim tokens');
      console.log('   GET  /api/faucet/status/:address - Check status');
      console.log('   GET  /api/faucet/assets         - List assets');
      console.log('   GET  /api/faucet/info           - Faucet info');
      console.log('\n✨ Ready to serve faucet requests!\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n🔄 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        database.close().then(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      console.log('\n🔄 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        database.close().then(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('1. Check your .env file configuration');
    console.error('2. Ensure PostgreSQL is running');
    console.error('3. Verify your wallet has BONE for gas fees');
    console.error('4. Check network connectivity to Shibarium RPC');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();