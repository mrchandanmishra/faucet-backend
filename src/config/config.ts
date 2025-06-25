import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  blockchain: {
    rpcUrl: string;
    privateKey: string;
    chainId: number;
  };
  contracts: {
    USDT: string;
    USDC: string;
    ETH: string;
    SHIB: string;
    TREAT: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  security: {
    jwtSecret: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'faucet_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  
  blockchain: {
    rpcUrl: process.env.TESTNET_RPC_URL || '',
    privateKey: process.env.PRIVATE_KEY || '',
    chainId: parseInt(process.env.CHAIN_ID || '11155111'),
  },
  
  contracts: {
    USDT: process.env.USDT_CONTRACT || '',
    USDC: process.env.USDC_CONTRACT || '',
    ETH: process.env.ETH_CONTRACT || '',
    SHIB: process.env.SHIB_CONTRACT || '',
    TREAT: process.env.TREAT_CONTRACT || '',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  },
};

export default config;