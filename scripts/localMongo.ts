import { MongoMemoryServer } from "mongodb-memory-server";

// Standalone long-running in-memory MongoDB for local dev, so the Next.js
// dev server and one-off scripts (seedAdmin) share the same database over a
// real TCP connection instead of each spinning up their own isolated instance.
async function main() {
  const port = Number(process.env.LOCAL_MONGO_PORT) || 27117;
  const mem = await MongoMemoryServer.create({
    instance: { port, dbName: "growsharks-pm" },
  });
  console.log(`[localMongo] listening at ${mem.getUri()}`);

  process.on("SIGINT", async () => {
    await mem.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
