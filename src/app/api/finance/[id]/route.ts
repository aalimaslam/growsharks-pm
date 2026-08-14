import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FinanceEntry } from "@/models/FinanceEntry";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateFinanceEntrySchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { FINANCE_LIST_PREFIX, financeOneKey } from "@/lib/cacheKeys";
import { canViewFinanceEntry, canEditFinanceEntry } from "@/lib/permissions";
import { recordAudit, diffFields } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const entry = await withCache(financeOneKey(id), 30, () =>
      FinanceEntry.findById(id).populate("createdBy", "name email").populate("reimbursedBy", "name email").lean()
    );
    if (!entry) throw new ApiError(404, "Entry not found");
    if (!canViewFinanceEntry(me, entry)) throw new ApiError(403, "Forbidden");
    return NextResponse.json(entry);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    const body = await parseBody(req, updateFinanceEntrySchema);
    await connectDB();

    const existing = await FinanceEntry.findById(id);
    if (!existing) throw new ApiError(404, "Entry not found");
    if (!canEditFinanceEntry(me, existing)) throw new ApiError(403, "Forbidden");

    const before = {
      amount: existing.amount,
      category: existing.category,
      description: existing.description,
      date: existing.date,
      status: existing.status,
    };

    const update: Record<string, unknown> = { ...body };
    if (body.date) update.date = new Date(body.date);
    if (body.isRecurring === false) update.recurrenceInterval = null;
    if (me.role !== "admin") {
      // Employees can tweak their own not-yet-reimbursed expense, but can't
      // reclassify it as income or opt themselves out of reimbursement.
      delete update.type;
    }

    const entry = await FinanceEntry.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("createdBy", "name email")
      .populate("reimbursedBy", "name email");
    if (!entry) throw new ApiError(404, "Entry not found");
    await Promise.all([cacheDel(FINANCE_LIST_PREFIX), cacheDel(financeOneKey(id))]);

    const after = {
      amount: entry.amount,
      category: entry.category,
      description: entry.description,
      date: entry.date,
      status: entry.status,
    };
    const changes = diffFields(before, after, Object.keys(after) as (keyof typeof after)[]);
    if (Object.keys(changes).length > 0) {
      await recordAudit({
        entityType: "finance",
        entityId: id,
        action: "update",
        actorId: me.id,
        message: `${me.name} updated ${entry.type} entry "${entry.category}"`,
        changes,
      });
    }
    return NextResponse.json(entry);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const existing = await FinanceEntry.findById(id);
    if (!existing) throw new ApiError(404, "Entry not found");
    if (!canEditFinanceEntry(me, existing)) throw new ApiError(403, "Forbidden");

    const entry = await FinanceEntry.findByIdAndDelete(id);
    if (!entry) throw new ApiError(404, "Entry not found");
    await Promise.all([cacheDel(FINANCE_LIST_PREFIX), cacheDel(financeOneKey(id))]);
    await recordAudit({
      entityType: "finance",
      entityId: id,
      action: "delete",
      actorId: me.id,
      message: `${me.name} deleted ${entry.type} entry "${entry.category}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
