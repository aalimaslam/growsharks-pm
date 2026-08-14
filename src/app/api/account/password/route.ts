import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { changePasswordSchema } from "@/lib/validators";
import { notify } from "@/lib/notify";
import { passwordChangedEmail } from "@/lib/emailTemplates";

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = await parseBody(req, changePasswordSchema);
    await connectDB();

    const user = await User.findById(me.id);
    if (!user) throw new ApiError(404, "User not found");

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) throw new ApiError(400, "Current password is incorrect");

    user.passwordHash = await bcrypt.hash(body.newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    const { subject, html } = passwordChangedEmail({ name: user.name });
    await notify({
      userId: user._id.toString(),
      email: user.email,
      type: "password-changed",
      message: "Your password was changed.",
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
