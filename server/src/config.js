import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/distributed_cache',
  maxEntries: Math.max(10, Number(process.env.CACHE_MAX_ENTRIES || 1000)),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
