import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireContentAccess, handleApiError } from "@/lib/apiUtils";

// A narrow, content-scoped roster (name/email only) so non-admin content
// team members can pick an assignee without needing the admin-only
// /api/users endpoint (which would also leak the full employee list).
export async function GET() {
  try {
    await requireContentAccess();
    await connectDB();
    const users = await User.find({ isContentTeam: true, isActive: true })
      .select("name email")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json(users);
  } catch (err) {
    return handleApiError(err);
  }
}
