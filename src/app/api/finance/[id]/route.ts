import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FinanceEntry } from "@/models/FinanceEntry";
import { requireAdmin, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateFinanceEntrySchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { FINANCE_LIST_PREFIX, financeOneKey } from "@/lib/cacheKeys";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await connectDB();

    const entry = await withCache(financeOneKey(id), 30, () => FinanceEntry.findById(id).lean());
    if (!entry) throw new ApiError(404, "Entry not found");
    return NextResponse.json(entry);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, updateFinanceEntrySchema);
    await connectDB();

    const update: Record<string, unknown> = { ...body };
    if (body.date) update.date = new Date(body.date);
    if (body.isRecurring === false) update.recurrenceInterval = null;

    const entry = await FinanceEntry.findByIdAndUpdate(id, update, { returnDocument: "after" });
    if (!entry) throw new ApiError(404, "Entry not found");
    await Promise.all([cacheDel(FINANCE_LIST_PREFIX), cacheDel(financeOneKey(id))]);
    return NextResponse.json(entry);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await connectDB();

    const entry = await FinanceEntry.findByIdAndDelete(id);
    if (!entry) throw new ApiError(404, "Entry not found");
    await Promise.all([cacheDel(FINANCE_LIST_PREFIX), cacheDel(financeOneKey(id))]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
