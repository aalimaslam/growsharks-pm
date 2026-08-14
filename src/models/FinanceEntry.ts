import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const attachmentSchema = new Schema(
  {
    dataUrl: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
  },
  { _id: false }
);

const financeEntrySchema = new Schema(
  {
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    date: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["paid", "pending", "overdue"], default: "paid" },
    isRecurring: { type: Boolean, default: false },
    recurrenceInterval: { type: String, enum: ["weekly", "monthly", "yearly", null], default: null },
    attachment: { type: attachmentSchema, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export type FinanceEntryDoc = InferSchemaType<typeof financeEntrySchema>;

export const FinanceEntry: Model<FinanceEntryDoc> =
  models.FinanceEntry || model<FinanceEntryDoc>("FinanceEntry", financeEntrySchema);
