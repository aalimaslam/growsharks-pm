import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceClientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    // Sequential per calendar year, e.g. INV-2026-0007 — assigned server-side
    // via lib/invoiceNumber.ts, never accepted from the client.
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    client: { type: invoiceClientSchema, required: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    items: { type: [invoiceItemSchema], default: [] },
    currency: { type: String, default: "INR" },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    discount: { type: Number, default: 0, min: 0 },
    // subtotal/taxAmount/total are always server-recomputed from
    // items+taxRate+discount (see lib/invoice.ts) — never trust client totals.
    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: INVOICE_STATUSES, default: "draft" },
    notes: { type: String, trim: true, default: "" },
    terms: { type: String, trim: true, default: "Payment due within 15 days of the invoice date." },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema>;

export const Invoice: Model<InvoiceDoc> = models.Invoice || model<InvoiceDoc>("Invoice", invoiceSchema);
