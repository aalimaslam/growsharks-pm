import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { requireAdmin, parseBody, handleApiError } from "@/lib/apiUtils";
import { createInvoiceSchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { INVOICE_LIST_PREFIX } from "@/lib/cacheKeys";
import { computeInvoiceTotals } from "@/lib/invoice";
import { nextInvoiceNumber } from "@/lib/invoiceNumber";
import { recordAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const project = searchParams.get("project");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q");

    const cacheKey = `${INVOICE_LIST_PREFIX}${searchParams.toString()}`;
    const invoices = await withCache(cacheKey, 30, () => {
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (project) filter.project = project;
      if (from || to) {
        filter.issueDate = {
          ...(from ? { $gte: new Date(from) } : {}),
          ...(to ? { $lte: new Date(to) } : {}),
        };
      }
      if (q) {
        filter.$or = [
          { invoiceNumber: { $regex: q, $options: "i" } },
          { "client.name": { $regex: q, $options: "i" } },
        ];
      }

      return Invoice.find(filter)
        .populate("createdBy", "name email")
        .populate("project", "name")
        .sort({ issueDate: -1, createdAt: -1 })
        .lean();
    });
    return NextResponse.json(invoices);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdmin();
    const body = await parseBody(req, createInvoiceSchema);
    await connectDB();

    const { itemsWithAmount, subtotal, taxAmount, total } = computeInvoiceTotals(
      body.items,
      body.taxRate,
      body.discount
    );
    const issueDate = new Date(body.issueDate);
    const invoiceNumber = await nextInvoiceNumber(issueDate);

    const invoice = await Invoice.create({
      invoiceNumber,
      client: body.client,
      project: body.project || null,
      items: itemsWithAmount,
      currency: body.currency,
      taxRate: body.taxRate,
      discount: body.discount,
      subtotal,
      taxAmount,
      total,
      issueDate,
      dueDate: new Date(body.dueDate),
      status: body.status,
      notes: body.notes,
      terms: body.terms,
      createdBy: me.id,
      sentAt: body.status === "sent" ? new Date() : null,
      paidAt: body.status === "paid" ? new Date() : null,
    });
    await invoice.populate("createdBy", "name email");

    await cacheDel(INVOICE_LIST_PREFIX);
    await recordAudit({
      entityType: "invoice",
      entityId: invoice._id.toString(),
      action: "create",
      actorId: me.id,
      message: `${me.name} created invoice ${invoiceNumber} for ${body.client.name} (${body.currency} ${total})`,
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
