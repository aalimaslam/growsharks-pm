import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { requireAdmin, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateInvoiceSchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { INVOICE_LIST_PREFIX, invoiceOneKey } from "@/lib/cacheKeys";
import { computeInvoiceTotals } from "@/lib/invoice";
import { recordAudit, diffFields } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await connectDB();

    const invoice = await withCache(invoiceOneKey(id), 30, () =>
      Invoice.findById(id).populate("createdBy", "name email").populate("project", "name").lean()
    );
    if (!invoice) throw new ApiError(404, "Invoice not found");
    return NextResponse.json(invoice);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, updateInvoiceSchema);
    await connectDB();

    const existing = await Invoice.findById(id);
    if (!existing) throw new ApiError(404, "Invoice not found");

    const before = { status: existing.status, total: existing.total, dueDate: existing.dueDate };

    const update: Record<string, unknown> = { ...body };
    if (body.issueDate) update.issueDate = new Date(body.issueDate);
    if (body.dueDate) update.dueDate = new Date(body.dueDate);

    if (body.items || body.taxRate !== undefined || body.discount !== undefined) {
      const items = body.items ?? existing.items;
      const taxRate = body.taxRate ?? existing.taxRate;
      const discount = body.discount ?? existing.discount;
      const { itemsWithAmount, subtotal, taxAmount, total } = computeInvoiceTotals(items, taxRate, discount);
      update.items = itemsWithAmount;
      update.subtotal = subtotal;
      update.taxAmount = taxAmount;
      update.total = total;
    }

    if (body.status && body.status !== existing.status) {
      if (body.status === "sent" && !existing.sentAt) update.sentAt = new Date();
      if (body.status === "paid") update.paidAt = new Date();
      if (body.status !== "paid" && existing.status === "paid") update.paidAt = null;
    }

    const invoice = await Invoice.findByIdAndUpdate(id, update, { returnDocument: "after" })
      .populate("createdBy", "name email")
      .populate("project", "name");
    if (!invoice) throw new ApiError(404, "Invoice not found");
    await Promise.all([cacheDel(INVOICE_LIST_PREFIX), cacheDel(invoiceOneKey(id))]);

    const after = { status: invoice.status, total: invoice.total, dueDate: invoice.dueDate };
    const changes = diffFields(before, after, Object.keys(after) as (keyof typeof after)[]);
    if (Object.keys(changes).length > 0) {
      const message =
        body.status && body.status !== before.status
          ? `${me.name} marked invoice ${invoice.invoiceNumber} as ${invoice.status}`
          : `${me.name} updated invoice ${invoice.invoiceNumber}`;
      await recordAudit({
        entityType: "invoice",
        entityId: id,
        action: "update",
        actorId: me.id,
        message,
        changes,
      });
    }
    return NextResponse.json(invoice);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAdmin();
    const { id } = await params;
    await connectDB();

    const invoice = await Invoice.findByIdAndDelete(id);
    if (!invoice) throw new ApiError(404, "Invoice not found");
    await Promise.all([cacheDel(INVOICE_LIST_PREFIX), cacheDel(invoiceOneKey(id))]);
    await recordAudit({
      entityType: "invoice",
      entityId: id,
      action: "delete",
      actorId: me.id,
      message: `${me.name} deleted invoice ${invoice.invoiceNumber}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
