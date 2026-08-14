import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FinanceEntry } from "@/models/FinanceEntry";
import { requireAdmin, parseBody, handleApiError } from "@/lib/apiUtils";
import { createFinanceEntrySchema } from "@/lib/validators";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q");

    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }
    if (q) filter.description = { $regex: q, $options: "i" };

    const entries = await FinanceEntry.find(filter).sort({ date: -1 });
    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdmin();
    const body = await parseBody(req, createFinanceEntrySchema);
    await connectDB();

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
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
