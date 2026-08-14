import { getRedis } from "@/lib/redis";

// Every key written through this module carries a TTL, so the eviction
// policy on the Redis server can safely be `allkeys-lru` (or `volatile-lru`,
// since nothing here is ever set without an expiry) — see .env.example /
// docker-compose.yml for the recommended `maxmemory` + `maxmemory-policy`.
// If Redis is unset or unreachable, every function here is a no-op/pass-through
// so a cache outage degrades to "always hits the database", never a crash.

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    console.error(`[cache] get(${key}) failed:`, err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[cache] set(${key}) failed:`, err);
  }
}

// Deletes an exact key, or every key under a prefix when called with
// something like "tasks:" (adds a trailing "*" and SCANs for matches — safe
// for production, unlike KEYS, since it doesn't block the server).
export async function cacheDel(keyOrPrefix: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (!keyOrPrefix.endsWith(":")) {
      await redis.del(keyOrPrefix);
      return;
    }
    const pattern = `${keyOrPrefix}*`;
    const stream = redis.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];
    for await (const found of stream) keys.push(...(found as string[]));
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    console.error(`[cache] del(${keyOrPrefix}) failed:`, err);
  }
}

// Read-through cache: serve from Redis when present, otherwise call `fetcher`,
// cache its result, and return it. On any cache failure it just falls back to
// `fetcher` directly.
export async function withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  void cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
