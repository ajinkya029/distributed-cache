// Tiny LRU cache. Map insertion order is used for least-recently-used eviction.
export class LocalCache {
  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry;
  }

  set(key, entry) {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }

  delete(key) { this.entries.delete(key); }
  clear() { this.entries.clear(); }
  get size() { return this.entries.size; }
  getStats() { return { size: this.size, maxEntries: this.maxEntries, hits: this.hits, misses: this.misses }; }
}
