import mongoose from "mongoose";

declare global {
  var __mongooseConn: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
    memoryServerUri: string | null;
  } | undefined;
}

const cached = global.__mongooseConn ?? { conn: null, promise: null, memoryServerUri: null };
global.__mongooseConn = cached;

async function resolveUri(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is not set. Add it to your environment before starting in production.");
  }

  // Dev convenience: no MONGODB_URI configured, spin up an in-memory MongoDB
  // so the app is runnable without installing MongoDB locally.
  if (!cached.memoryServerUri) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    cached.memoryServerUri = mem.getUri();
    console.warn(
      `[db] MONGODB_URI not set — using an in-memory MongoDB for local dev at ${cached.memoryServerUri}. ` +
        "Data will not persist across server restarts. Set MONGODB_URI in .env.local to use a real database."
    );
  }
  return cached.memoryServerUri;
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = await resolveUri();
    cached.promise = mongoose.connect(uri).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
