import mongoose from 'mongoose';

const cacheEntrySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 512 },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

cacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

export const CacheEntry = mongoose.model('CacheEntry', cacheEntrySchema);
