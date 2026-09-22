/**
 * Redis cache layer for hot reads.
 * Falls back gracefully to no-cache if Redis is unavailable.
 *
 * Usage:
 *   const jobs = await cached('jobs:open', 30, () => getCachedJobs({ status: 1 }));
 */

import { logger } from './logger';

let redisClient: RedisLike | null = null;
let redisUnavailable = false;

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

/** Connect to Redis. Call once at startup. */
export async function connectRedis(url?: string): Promise<void> {
  const redisUrl = url || process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('redis_skip', { reason: 'REDIS_URL not configured, caching disabled' });
    redisUnavailable = true;
    return;
  }
  try {
    // Dynamic import so the app doesn't crash if redis isn't installed
    // @ts-ignore — redis is an optional dependency
    const mod = await import('redis');
    const createClient = mod.createClient || mod.default?.createClient;
    if (!createClient) throw new Error('redis module has no createClient export');
    redisClient = createClient({ url: redisUrl }) as RedisLike;
    await (redisClient as any).connect();
    logger.info('redis_connected', { url: redisUrl.replace(/\/\/.*@/, '//***@') });
  } catch (err) {
    logger.warn('redis_connect_failed', { error: (err as Error).message });
    redisUnavailable = true;
  }
}

/**
 * Read-through cache.
 * @param key   Cache key
 * @param ttl   Time-to-live in seconds
 * @param fetch Function that returns fresh data if cache misses
 */
export async function cached<T>(key: string, ttl: number, fetch: () => T | Promise<T>): Promise<T> {
  if (redisUnavailable || !redisClient) return fetch();

  try {
    const hit = await redisClient.get(key);
    if (hit) {
      logger.info('cache_hit', { key });
      return JSON.parse(hit) as T;
    }
  } catch {
    // Redis read failed, fall through to fetch
  }

  const data = await fetch();

  try {
    await redisClient.set(key, JSON.stringify(data), { EX: ttl });
  } catch {
    // Redis write failed, data still returned
  }

  return data;
}

/** Invalidate a cache key. */
export async function invalidate(key: string): Promise<void> {
  if (redisUnavailable || !redisClient) return;
  try {
    await redisClient.del(key);
  } catch {
    // Best-effort invalidation
  }
}
