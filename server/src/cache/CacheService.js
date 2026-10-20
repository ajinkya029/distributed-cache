import { CacheEntry } from '../models/CacheEntry.js';
import { LocalCache } from './LocalCache.js';

export class CacheService {
  constructor(maxEntries) {
    this.local = new LocalCache(maxEntries);
    this.nodeId = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    this.watchStream = null;
  }

  async startInvalidationStream() {
    try {
      this.watchStream = CacheEntry.watch([], { fullDocument: 'updateLookup' });
      this.watchStream.on('change', (change) => {
        const key = change.fullDocument?.key;
        if (key) this.local.delete(key);
        // Delete events don't include the deleted document by default, so clear
        // this process's bounded cache to avoid serving a deleted key from memory.
        if (change.operationType === 'delete') this.local.clear();
      });
      this.watchStream.on('error', (err) => {
        console.error('Cache invalidation stream error:', err.message);
      });
    } catch (err) {
      console.warn('Change stream unavailable; cross-node local invalidation disabled:', err.message);
    }
  }

  async get(key) {
    const local = this.local.get(key);
    if (local) return { key, value: local.value, expiresAt: local.expiresAt, source: 'local' };

    const doc = await CacheEntry.findOne({ key }).lean();
    if (!doc) return null;
    if (doc.expiresAt && doc.expiresAt.getTime() <= Date.now()) {
      await CacheEntry.deleteOne({ key });
      this.local.delete(key);
      return null;
    }
    const entry = { value: doc.value, expiresAt: doc.expiresAt || null };
    this.local.set(key, entry);
    return { key, ...entry, source: 'mongo' };
  }

  async set(key, value, ttlSeconds = null) {
    const expiresAt = ttlSeconds == null ? null : new Date(Date.now() + ttlSeconds * 1000);
    const doc = await CacheEntry.findOneAndUpdate(
      { key },
      { $set: { value, expiresAt, updatedAt: new Date() } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    const entry = { value: doc.value, expiresAt: doc.expiresAt || null };
    this.local.set(key, entry);
    return { key, ...entry };
  }

  async delete(key) {
    const result = await CacheEntry.deleteOne({ key });
    this.local.delete(key);
    return result.deletedCount > 0;
  }

  async list({ limit = 100, prefix = '' } = {}) {
    const query = { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] };
    if (prefix) query.key = { $regex: `^${escapeRegex(prefix)}` };
    const docs = await CacheEntry.find(query).select('key expiresAt updatedAt').sort({ updatedAt: -1 }).limit(limit).lean();
    return docs;
  }

  async close() {
    if (this.watchStream) await this.watchStream.close().catch(() => {});
  }

  stats() {
    return { nodeId: this.nodeId, localCache: this.local.getStats() };
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
