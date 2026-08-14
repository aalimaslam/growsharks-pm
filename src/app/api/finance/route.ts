import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FinanceEntry } from "@/models/FinanceEntry";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { createFinanceEntrySchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { FINANCE_LIST_PREFIX } from "@/lib/cacheKeys";
import { recordAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const me = await requireUser();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q");
    const reimbursable = searchParams.get("reimbursable");
    const reimbursed = searchParams.get("reimbursed");

    // Scope is part of the cache key: employees must never be served
    // another user's cached (filtered) list.
    const scope = me.role === "admin" ? "admin" : me.id;
    const cacheKey = `${FINANCE_LIST_PREFIX}${scope}:${searchParams.toString()}`;
    const entries = await withCache(cacheKey, 30, () => {
      const filter: Record<string, unknown> = {};
      if (me.role !== "admin") filter.createdBy = me.id;
      if (type) filter.type = type;
      if (category) filter.category = category;
      if (status) filter.status = status;
      if (reimbursable !== null) filter.reimbursable = reimbursable === "true";
      if (reimbursed !== null) filter.reimbursed = reimbursed === "true";
      if (from || to) {
        filter.date = {
          ...(from ? { $gte: new Date(from) } : {}),
          ...(to ? { $lte: new Date(to) } : {}),
        };
      }
      if (q) filter.description = { $regex: q, $options: "i" };

      return FinanceEntry.find(filter)
        .select("-attachment.dataUrl")
        .populate("createdBy", "name email")
        .populate("reimbursedBy", "name email")
        .sort({ date: -1 })
        .lean();
    });
    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = await parseBody(req, createFinanceEntrySchema);
    await connectDB();

    if (me.role !== "admin" && body.type !== "expense") {
      throw new ApiError(403, "Employees can only submit expense entries");
    }
    // Employees' own expenses are always reimbursable; admins can opt a
    // company entry in (e.g. their own out-of-pocket expense) but default
    // to false so ordinary company income/expense entries are unaffected.
    const reimbursable = me.role === "admin" ? (body.reimbursable ?? false) : true;

    const entry = await FinanceEntry.create({
      type: body.type,
      amount: body.amount,
      currency: body.currency,
      category: body.category,
      description: body.description,
      date: new Date(body.date),
      status: body.status,
      isRecurring: body.isRecurring,
      recurrenceInterval: body.isRecurring ? body.recurrenceInterval || null : null,
      attachment: body.attachment || null,
      createdBy: me.id,
      reimbursable,
    });
    await entry.populate("createdBy", "name email");

    await cacheDel(FINANCE_LIST_PREFIX);
    await recordAudit({
      entityType: "finance",
      entityId: entry._id.toString(),
      action: "create",
      actorId: me.id,
      message: `${me.name} added ${entry.type} entry "${entry.category}" (${entry.currency} ${entry.amount})${reimbursable ? " — reimbursable" : ""}`,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
