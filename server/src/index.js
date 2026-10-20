import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config.js';
import { CacheService } from './cache/CacheService.js';
import { createCacheRouter } from './routes/cache.js';

const app = express();
const cache = new CacheService(config.maxEntries);

app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({
  status: mongoose.connection.readyState === 1 ? 'ok' : 'starting',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  nodeId: cache.nodeId,
}));

app.get('/api/stats', (_req, res) => res.json(cache.stats()));
app.use('/api/cache', createCacheRouter(cache));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier' });
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await mongoose.connect(config.mongoUri);
  await cache.startInvalidationStream();
  const server = app.listen(config.port, () => console.log(`Cache API listening on :${config.port}`));
  const shutdown = async () => {
    server.close();
    await cache.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
