import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireAdmin, parseBody, handleApiError } from "@/lib/apiUtils";
import { createEmployeeSchema } from "@/lib/validators";
import { generateTempPassword } from "@/lib/password";
import { notify } from "@/lib/notify";
import { welcomeEmail } from "@/lib/emailTemplates";
import { withCache, cacheDel } from "@/lib/cache";
import { USERS_LIST_KEY } from "@/lib/cacheKeys";

export async function GET() {
  try {
    await requireAdmin();
    await connectDB();
    const users = await withCache(USERS_LIST_KEY, 60, () =>
      User.find().select("-passwordHash").sort({ createdAt: -1 }).lean()
    );
    return NextResponse.json(users);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await parseBody(req, createEmployeeSchema);
    await connectDB();

    const existing = await User.findOne({ email: body.email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      role: body.role,
      title: body.title,
      passwordHash,
      mustChangePassword: true,
    });

    const { subject, html } = welcomeEmail({ name: user.name, email: user.email, tempPassword });
    await notify({
      userId: user._id.toString(),
      email: user.email,
      type: "account-created",
      message: "Your GrowSharks PM account was created.",
      link: "/login",
      subject,
      html,
    });

    const { passwordHash: _omit, ...safe } = user.toObject();
    void _omit;
    await cacheDel(USERS_LIST_KEY);
    return NextResponse.json(safe, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
