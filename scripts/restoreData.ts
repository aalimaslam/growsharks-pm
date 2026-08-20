import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "fs";
import path from "path";
import mongoose, { type Model } from "mongoose";
import { connectDB } from "../src/lib/db";
import { User } from "../src/models/User";
import { Project } from "../src/models/Project";
import { Task } from "../src/models/Task";
import { FinanceEntry } from "../src/models/FinanceEntry";
import { Notification } from "../src/models/Notification";
import { AuditLog } from "../src/models/AuditLog";
import { ContentPost } from "../src/models/ContentPost";

// Loads a JSON file produced by scripts/backupData.ts back into the
// database. Upserts by _id (via bulkWrite), so it's safe to run against an
// empty database, or to re-run against one that already has some of the
// same documents — existing docs get overwritten with the backed-up
// version, nothing is duplicated.
//
// Dry run by default — pass --confirm to actually write.
//   npx tsx scripts/restoreData.ts backups/backup-....json            (shows counts only)
//   npx tsx scripts/restoreData.ts backups/backup-....json --confirm  (restores)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertAll(model: Model<any>, docs: any[]): Promise<void> {
  if (docs.length === 0) return;
  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: doc },
      upsert: true,
    },
  }));
  await model.bulkWrite(ops, { ordered: false });
}

async function main() {
  const filePath = process.argv[2];
  const confirm = process.argv.includes("--confirm");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/restoreData.ts <path-to-backup.json> [--confirm]");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const backup = JSON.parse(raw);
  const collections = backup.collections || {};

  const counts = {
    users: (collections.users || []).length,
    projects: (collections.projects || []).length,
    tasks: (collections.tasks || []).length,
    financeEntries: (collections.financeEntries || []).length,
    notifications: (collections.notifications || []).length,
    auditLogs: (collections.auditLogs || []).length,
    contentPosts: (collections.contentPosts || []).length,
  };

  console.log(`Backup file: ${filePath}`);
  console.log(`Exported at: ${backup.exportedAt || "unknown"}`);
  console.log("\nWill upsert:");
  console.log(`  Users:            ${counts.users}`);
  console.log(`  Projects:         ${counts.projects}`);
  console.log(`  Tasks:            ${counts.tasks}`);
  console.log(`  Finance entries:  ${counts.financeEntries}`);
  console.log(`  Notifications:    ${counts.notifications}`);
  console.log(`  Audit log entries:${counts.auditLogs}`);
  console.log(`  Content posts:    ${counts.contentPosts}`);

  if (!confirm) {
    console.log("\nDry run only — nothing was written. Re-run with --confirm to actually restore.");
    return;
  }

  await connectDB();
  console.log(`\nConnected to: ${mongoose.connection.name} @ ${mongoose.connection.host}`);

  // Users and Projects first — Tasks/FinanceEntries/Notifications/AuditLog/
  // ContentPost reference them, though upsert order doesn't strictly matter
  // for Mongo (no FK enforcement), this keeps the log readable top-to-bottom.
  await upsertAll(User, collections.users || []);
  await upsertAll(Project, collections.projects || []);
  await upsertAll(Task, collections.tasks || []);
  await upsertAll(FinanceEntry, collections.financeEntries || []);
  await upsertAll(Notification, collections.notifications || []);
  await upsertAll(AuditLog, collections.auditLogs || []);
  await upsertAll(ContentPost, collections.contentPosts || []);

  console.log("\nDone. Data restored.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
