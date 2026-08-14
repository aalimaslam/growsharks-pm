import { EventEmitter } from "events";
import { getRedis } from "@/lib/redis";

// Pushes notifications to connected SSE clients instead of clients polling
// for them. Single-instance deployments (no REDIS_URL) work via a plain
// in-process EventEmitter. When Redis is configured, publish goes through a
// Redis pub/sub channel instead — the only path back to the local emitter is
// the subscription bridge below, so multi-instance deployments fan out
// correctly and a single instance never double-delivers its own publish.
const CHANNEL = "notifications";
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let bridgeReady = false;

function ensureRedisBridge() {
  if (bridgeReady) return;
  const redis = getRedis();
  if (!redis) return;
  bridgeReady = true;

  const sub = redis.duplicate();
  sub.on("error", (err) => console.error("[notifyBus] subscriber error:", err.message));
  sub.subscribe(CHANNEL).catch((err) => console.error("[notifyBus] subscribe failed:", err));
  sub.on("message", (_channel, raw) => {
    try {
      const { userId, notification } = JSON.parse(raw);
      emitter.emit(userId, notification);
    } catch (err) {
      console.error("[notifyBus] failed to parse message:", err);
    }
  });
}

export function publishNotification(userId: string, notification: unknown): void {
  const redis = getRedis();
  if (redis) {
    redis.publish(CHANNEL, JSON.stringify({ userId, notification })).catch((err) => {
      console.error("[notifyBus] publish failed:", err);
    });
  } else {
    emitter.emit(userId, notification);
  }
}

// Returns an unsubscribe function. Caller owns the connection lifecycle
// (e.g. the SSE route unsubscribes when the client disconnects).
export function subscribeToUser(userId: string, onNotification: (notification: unknown) => void): () => void {
  ensureRedisBridge();
  emitter.on(userId, onNotification);
  return () => emitter.off(userId, onNotification);
}
