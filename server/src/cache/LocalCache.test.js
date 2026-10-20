import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalCache } from './LocalCache.js';

test('stores and retrieves entries', () => {
  const cache = new LocalCache(2);
  cache.set('a', { value: 1, expiresAt: null });
  assert.equal(cache.get('a').value, 1);
});

test('evicts least recently used entry', () => {
  const cache = new LocalCache(2);
  cache.set('a', { value: 1 });
  cache.set('b', { value: 2 });
  cache.get('a');
  cache.set('c', { value: 3 });
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a').value, 1);
});

test('does not return expired entries', () => {
  const cache = new LocalCache(2);
  cache.set('expired', { value: 'x', expiresAt: new Date(Date.now() - 1000) });
  assert.equal(cache.get('expired'), undefined);
});
