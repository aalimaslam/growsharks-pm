import { config } from "dotenv";
config({ path: ".env.local" });
config();

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Project } from "../src/models/Project";
import { Task } from "../src/models/Task";
import { FinanceEntry } from "../src/models/FinanceEntry";
import { Notification } from "../src/models/Notification";
import { User } from "../src/models/User";

// Clears operational data (projects, tasks, finance entries, notifications)
// so the app starts fresh. Deliberately leaves the User collection untouched
// so existing logins (including admin) keep working.
//
// Dry run by default — pass --confirm to actually delete.
//   npx tsx scripts/resetData.ts            (shows counts only)
//   npx tsx scripts/resetData.ts --confirm   (deletes)

async function main() {
  const confirm = process.argv.includes("--confirm");

  await connectDB();
  console.log(`Connected to: ${mongoose.connection.name} @ ${mongoose.connection.host}`);

  const counts = {
    projects: await Project.countDocuments(),
    tasks: await Task.countDocuments(),
    financeEntries: await FinanceEntry.countDocuments(),
    notifications: await Notification.countDocuments(),
    users: await User.countDocuments(),
  };

  console.log("\nWill delete:");
  console.log(`  Projects:       ${counts.projects}`);
  console.log(`  Tasks:          ${counts.tasks}`);
  console.log(`  Finance entries:${counts.financeEntries}`);
  console.log(`  Notifications:  ${counts.notifications}`);
  console.log(`  Users:          ${counts.users}`);
  // console.log("\nUsers collection is left untouched.");

  if (!confirm) {
    console.log("\nDry run only — nothing was deleted. Re-run with --confirm to actually delete.");
    await mongoose.disconnect();
    return;
  }

  await Promise.all([
    Project.deleteMany({}),
    Task.deleteMany({}),
    FinanceEntry.deleteMany({}),
    Notification.deleteMany({}),
    User.deleteMany({}),
  ]);

  console.log("\nDone. All projects, tasks, finance entries, notifications, and users were deleted.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
