import database from '../services/database';

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Test connection
    const connected = await database.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Create tables
    await database.createTables();
    
    // Seed initial data
    await database.seedAssets();
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupDatabase().then(() => {
    process.exit(0);
  });
}

export default setupDatabase;