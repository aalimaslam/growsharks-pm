import { config } from "dotenv";
// Standalone scripts don't get Next.js's automatic .env.local loading.
config({ path: ".env.local" });
config();

import bcrypt from "bcryptjs";
import { connectDB } from "../src/lib/db";
import { User } from "../src/models/User";
import mongoose from "mongoose";

async function main() {
  const name = process.env.SEED_ADMIN_NAME || "Admin";
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@growsharks.com").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "change-me-please";

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email} (role: ${existing.role})`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ name, email, passwordHash, role: "admin", isActive: true });

  console.log(`Created admin user:\n  Email:    ${email}\n  Password: ${password}\nSign in and change the password from your profile.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
