import Redis from "ioredis";

declare global {
  var __redisClient: Redis | null | undefined;
}

// Caching is an optimization, not a dependency: with no REDIS_URL configured
// (e.g. local dev) or if the server is unreachable, every helper in cache.ts
// falls back to hitting the database directly rather than throwing.
export function getRedis(): Redis | null {
  if (global.__redisClient !== undefined) return global.__redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    global.__redisClient = null;
    return null;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: false,
  });

  client.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });

  global.__redisClient = client;
  return client;
}
