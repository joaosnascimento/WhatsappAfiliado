import Redis from 'ioredis';

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000), enableReadyCheck: true, lazyConnect: false })
  : null;

export function requireRedis() {
  if (!redis) throw new Error('REDIS_URL is required for queue/scheduler workers.');
  return redis;
}
