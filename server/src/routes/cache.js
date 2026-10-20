import { Router } from 'express';

export function createCacheRouter(cache) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(500, Math.max(1, Number.parseInt(req.query.limit || '100', 10) || 100));
      const prefix = String(req.query.prefix || '');
      const keys = await cache.list({ limit, prefix });
      res.json({ count: keys.length, keys });
    } catch (err) { next(err); }
  });

  router.get('/:key', async (req, res, next) => {
    try {
      const result = await cache.get(req.params.key);
      if (!result) return res.status(404).json({ error: 'Cache key not found', key: req.params.key });
      res.json(result);
    } catch (err) { next(err); }
  });

  router.put('/:key', async (req, res, next) => {
    try {
      if (!Object.hasOwn(req.body || {}, 'value')) {
        return res.status(400).json({ error: 'Request body must include a value property' });
      }
      let ttlSeconds = null;
      if (req.body.ttlSeconds !== undefined && req.body.ttlSeconds !== null && req.body.ttlSeconds !== '') {
        ttlSeconds = Number(req.body.ttlSeconds);
        if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 31536000) {
          return res.status(400).json({ error: 'ttlSeconds must be between 1 and 31536000' });
        }
      }
      const result = await cache.set(req.params.key, req.body.value, ttlSeconds);
      res.status(200).json(result);
    } catch (err) { next(err); }
  });

  router.delete('/:key', async (req, res, next) => {
    try {
      const deleted = await cache.delete(req.params.key);
      if (!deleted) return res.status(404).json({ error: 'Cache key not found', key: req.params.key });
      res.json({ deleted: true, key: req.params.key });
    } catch (err) { next(err); }
  });

  return router;
}
