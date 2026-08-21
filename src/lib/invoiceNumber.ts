import { Counter } from "@/models/Counter";

// Atomic per-calendar-year sequence, e.g. INV-2026-0007. Uses a Counter
// document with $inc so concurrent creates never collide, regardless of
// whether earlier invoices were later deleted. Server-only (touches the DB) —
// kept out of lib/invoice.ts so that pure calc helpers stay client-importable.
export async function nextInvoiceNumber(referenceDate: Date): Promise<string> {
  const year = referenceDate.getFullYear();
  const key = `invoice:${year}`;
  const counter = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `INV-${year}-${String(counter.seq).padStart(4, "0")}`;
}
