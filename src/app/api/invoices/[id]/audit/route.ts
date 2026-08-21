import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { requireAdmin, handleApiError } from "@/lib/apiUtils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await connectDB();

    const entries = await AuditLog.find({ entityType: "invoice", entityId: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actor", "name email role")
      .lean();

    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}
