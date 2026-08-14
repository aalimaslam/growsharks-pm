import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireAdmin, requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateUserSchema } from "@/lib/validators";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    if (me.role !== "admin" && me.id !== id) throw new ApiError(403, "Forbidden");

    await connectDB();
    const user = await User.findById(id).select("-passwordHash");
    if (!user) throw new ApiError(404, "User not found");
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, updateUserSchema);

    await connectDB();
    const user = await User.findByIdAndUpdate(id, body, { returnDocument: "after" }).select("-passwordHash");
    if (!user) throw new ApiError(404, "User not found");
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAdmin();
    const { id } = await params;
    if (me.id === id) throw new ApiError(400, "You cannot delete your own account");

    await connectDB();
    const user = await User.findById(id).select("-passwordHash");
    if (!user) throw new ApiError(404, "User not found");

    if (user.role === "admin" && user.isActive) {
      const activeAdminCount = await User.countDocuments({ role: "admin", isActive: true });
      if (activeAdminCount <= 1) {
        throw new ApiError(400, "You cannot delete the last active admin");
      }
    }

    await User.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
