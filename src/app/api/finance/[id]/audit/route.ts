import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { FinanceEntry } from "@/models/FinanceEntry";
import { requireUser, handleApiError, ApiError } from "@/lib/apiUtils";
import { canViewFinanceEntry } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const entry = await FinanceEntry.findById(id);
    if (!entry) throw new ApiError(404, "Entry not found");
    if (!canViewFinanceEntry(me, entry)) throw new ApiError(403, "Forbidden");

    const entries = await AuditLog.find({ entityType: "finance", entityId: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actor", "name email role")
      .lean();

    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}
