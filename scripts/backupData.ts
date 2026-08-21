import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { User } from "../src/models/User";
import { Project } from "../src/models/Project";
import { Task } from "../src/models/Task";
import { FinanceEntry } from "../src/models/FinanceEntry";
import { Notification } from "../src/models/Notification";
import { AuditLog } from "../src/models/AuditLog";
import { ContentPost } from "../src/models/ContentPost";
import { Invoice } from "../src/models/Invoice";
import { Counter } from "../src/models/Counter";

// Dumps every collection to a single JSON file that scripts/restoreData.ts
// can load back in later (e.g. after a migration, or to move data between
// environments). ObjectIds/Dates serialize to plain strings via each
// document's own toJSON (same as every API route's NextResponse.json call),
// so the file round-trips cleanly through JSON with no custom encoding.
//
//   npx tsx scripts/backupData.ts [outputPath]
//
// Defaults to backups/backup-<timestamp>.json. The backups/ directory is
// gitignored — these dumps contain password hashes and other sensitive data
// and must never be committed.

async function main() {
  const outArg = process.argv[2];

  await connectDB();
  console.log(`Connected to: ${mongoose.connection.name} @ ${mongoose.connection.host}`);

  const [users, projects, tasks, financeEntries, notifications, auditLogs, contentPosts, invoices, counters] =
    await Promise.all([
      User.find().lean(),
      Project.find().lean(),
      Task.find().lean(),
      FinanceEntry.find().lean(),
      Notification.find().lean(),
      AuditLog.find().lean(),
      ContentPost.find().lean(),
      Invoice.find().lean(),
      Counter.find().lean(),
    ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    collections: {
      users,
      projects,
      tasks,
      financeEntries,
      notifications,
      auditLogs,
      contentPosts,
      invoices,
      counters,
    },
  };

  const outPath = outArg
    ? path.resolve(outArg)
    : path.resolve("backups", `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(backup, null, 2));

  console.log("\nBacked up:");
  console.log(`  Users:            ${users.length}`);
  console.log(`  Projects:         ${projects.length}`);
  console.log(`  Tasks:            ${tasks.length}`);
  console.log(`  Finance entries:  ${financeEntries.length}`);
  console.log(`  Notifications:    ${notifications.length}`);
  console.log(`  Audit log entries:${auditLogs.length}`);
  console.log(`  Content posts:    ${contentPosts.length}`);
  console.log(`  Invoices:         ${invoices.length}`);
  console.log(`  Counters:         ${counters.length}`);
  console.log(`\nWritten to: ${outPath}`);
  console.log("Restore with: npx tsx scripts/restoreData.ts " + path.relative(process.cwd(), outPath) + " --confirm");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
