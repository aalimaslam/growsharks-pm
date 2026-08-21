// Pure calculation helpers — safe to import from client components. Server-only
// numbering (which touches the DB) lives in lib/invoiceNumber.ts instead.

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Recomputed server-side on every create/update — line-item amounts and the
// subtotal/tax/total are derived, never trusted from the client.
export function computeInvoiceTotals(items: InvoiceLineItemInput[], taxRate: number, discount: number) {
  const itemsWithAmount = items.map((item) => ({
    ...item,
    amount: round2(item.quantity * item.unitPrice),
  }));
  const subtotal = round2(itemsWithAmount.reduce((sum, item) => sum + item.amount, 0));
  const taxableBase = Math.max(subtotal - discount, 0);
  const taxAmount = round2(taxableBase * (taxRate / 100));
  const total = round2(taxableBase + taxAmount);
  return { itemsWithAmount, subtotal, taxAmount, total };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
