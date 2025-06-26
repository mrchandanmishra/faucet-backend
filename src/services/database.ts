import { Pool, PoolClient } from 'pg';
import config from '../config/config';

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('✅ Database connected successfully at:', result.rows[0].now);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  async createTables(): Promise<void> {
    try {
      // Create claims table
      await this.query(`
        CREATE TABLE IF NOT EXISTS claims (
          id SERIAL PRIMARY KEY,
          wallet_address VARCHAR(42) NOT NULL,
          asset VARCHAR(10) NOT NULL,
          amount DECIMAL(18,8) NOT NULL,
          tx_hash VARCHAR(66),
          status VARCHAR(20) DEFAULT 'pending',
          claimed_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create unique constraint separately (some PostgreSQL versions have issues with inline constraints)
      await this.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_claim 
        ON claims (wallet_address, asset, DATE(claimed_at))
      `);

      // Create cooldowns table
      await this.query(`
        CREATE TABLE IF NOT EXISTS cooldowns (
          wallet_address VARCHAR(42) NOT NULL,
          asset VARCHAR(10) NOT NULL,
          last_claim_at TIMESTAMP NOT NULL,
          PRIMARY KEY (wallet_address, asset)
        )
      `);

      // Create assets table
      await this.query(`
        CREATE TABLE IF NOT EXISTS assets (
          symbol VARCHAR(10) PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          amount DECIMAL(18,8) NOT NULL,
          cooldown_hours INTEGER NOT NULL,
          contract_address VARCHAR(42),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  async seedAssets(): Promise<void> {
    try {
      const assets = [
        { symbol: 'BONE', name: 'BONE', amount: '0.1', cooldown_hours: 8, contract_address: 'native' },
        { symbol: 'SHIB', name: 'Shiba Inu', amount: '1000', cooldown_hours: 8, contract_address: config.contracts.SHIB },
        { symbol: 'TREAT', name: 'TREAT', amount: '5', cooldown_hours: 8, contract_address: config.contracts.TREAT },
        { symbol: 'USDT', name: 'Tether USD', amount: '1', cooldown_hours: 8, contract_address: config.contracts.USDT },
        { symbol: 'USDC', name: 'USD Coin', amount: '1', cooldown_hours: 8, contract_address: config.contracts.USDC },
      ];

      for (const asset of assets) {
        await this.query(
          `INSERT INTO assets (symbol, name, amount, cooldown_hours, contract_address) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (symbol) DO UPDATE SET 
             name = EXCLUDED.name,
             amount = EXCLUDED.amount,
             cooldown_hours = EXCLUDED.cooldown_hours,
             contract_address = EXCLUDED.contract_address`,
          [asset.symbol, asset.name, asset.amount, asset.cooldown_hours, asset.contract_address]
        );
      }

      console.log('✅ Assets seeded successfully');
    } catch (error) {
      console.error('❌ Error seeding assets:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default new DatabaseService();