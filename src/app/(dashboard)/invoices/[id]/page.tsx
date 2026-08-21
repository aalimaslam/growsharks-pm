"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Printer, Pencil, CheckCircle2, Send } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { formatMoney } from "@/lib/invoice";
import { COMPANY } from "@/lib/companyInfo";
import type { InvoiceJSON, InvoiceStatus } from "@/types";
import { invoiceStatusColors } from "@/lib/badgeColors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuditTrail } from "@/components/AuditTrail";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceJSON | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<InvoiceJSON>(`/api/invoices/${id}`);
      setInvoice(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (status: InvoiceStatus) => {
    if (!invoice) return;
    try {
      const updated = await apiFetch<InvoiceJSON>(`/api/invoices/${invoice._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setInvoice(updated);
      setRefreshKey((k) => k + 1);
      toast.success(`Marked as ${status}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update status");
    }
  };

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto text-sm text-muted-foreground">Loading invoice...</div>;
  }
  if (!invoice) {
    return <div className="p-6 max-w-4xl mx-auto text-sm text-muted-foreground">Invoice not found.</div>;
  }

  const client = invoice.client;
  const projectName = typeof invoice.project === "object" && invoice.project ? invoice.project.name : null;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.push("/invoices")}>
          <ArrowLeft className="size-3.5" /> Back to invoices
        </Button>
        <div className="flex items-center gap-2">
          {invoice.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("sent")}>
              <Send className="size-3.5" /> Mark as sent
            </Button>
          )}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("paid")}>
              <CheckCircle2 className="size-3.5" /> Mark as paid
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Printable sheet */}
      <div className="rounded-xl border border-border/80 bg-white text-[#15171a] shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <div className="p-8 sm:p-10 print:p-0 flex flex-col gap-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-6 border-b border-[#e4e8ee] pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- static local logo; next/image's
                optimizer needs `sharp` (not installed) and print output shouldn't depend on it anyway */}
            <img
              src="/brand/growsharks-logo-side.png"
              alt="GrowSharks"
              width={1343}
              height={298}
              className="h-14 w-auto object-contain object-left"
            />
            <div className="text-right">
              <h1 className="text-2xl font-semibold tracking-tight text-[#0f1115]">INVOICE</h1>
              <p className="text-sm text-[#68707d] mt-0.5">{invoice.invoiceNumber}</p>
              <Badge className={cn("capitalize border-transparent text-[11px] px-2 py-0.5 mt-2", invoiceStatusColors[invoice.status])}>
                {invoice.status}
              </Badge>
            </div>
          </div>

          {/* Billed by / to */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad] mb-1.5">Billed by</p>
              <p className="text-sm font-semibold text-[#0f1115]">{COMPANY.name}</p>
              <p className="text-sm text-[#454c56] leading-relaxed whitespace-pre-line">{COMPANY.address}</p>
              <p className="text-sm text-[#454c56]">{COMPANY.email}</p>
              <p className="text-sm text-[#454c56]">{COMPANY.phone}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad] mb-1.5">Billed to</p>
              <p className="text-sm font-semibold text-[#0f1115]">{client.name}</p>
              {client.address && <p className="text-sm text-[#454c56] leading-relaxed whitespace-pre-line">{client.address}</p>}
              {client.email && <p className="text-sm text-[#454c56]">{client.email}</p>}
              {client.phone && <p className="text-sm text-[#454c56]">{client.phone}</p>}
              {projectName && <p className="text-sm text-[#454c56] mt-1">Project: {projectName}</p>}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-lg bg-[#f6f8fb] px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad]">Issue date</p>
              <p className="text-sm font-medium text-[#0f1115]">{new Date(invoice.issueDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad]">Due date</p>
              <p className="text-sm font-medium text-[#0f1115]">{new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad]">Amount due</p>
              <p className="text-sm font-semibold text-[#1769e0]">{formatMoney(invoice.total, invoice.currency)}</p>
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-[#0f1115]">
                <th className="text-left font-semibold text-[#0f1115] py-2">Description</th>
                <th className="text-right font-semibold text-[#0f1115] py-2 w-20">Qty</th>
                <th className="text-right font-semibold text-[#0f1115] py-2 w-28">Rate</th>
                <th className="text-right font-semibold text-[#0f1115] py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b border-[#e4e8ee]">
                  <td className="py-2.5 text-[#25282e]">{item.description}</td>
                  <td className="py-2.5 text-right text-[#454c56] tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 text-right text-[#454c56] tabular-nums">{formatMoney(item.unitPrice, invoice.currency)}</td>
                  <td className="py-2.5 text-right text-[#0f1115] font-medium tabular-nums">{formatMoney(item.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-[#68707d]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-[#68707d]">
                  <span>Discount</span>
                  <span className="tabular-nums">-{formatMoney(invoice.discount, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#68707d]">
                <span>Tax ({invoice.taxRate}%)</span>
                <span className="tabular-nums">{formatMoney(invoice.taxAmount, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-[#0f1115] pt-2 mt-1 border-t-2 border-[#0f1115]">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {(invoice.notes || invoice.terms) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-[#e4e8ee] pt-6">
              {invoice.notes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad] mb-1">Notes</p>
                  <p className="text-sm text-[#454c56] whitespace-pre-line leading-relaxed">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9aa2ad] mb-1">Terms</p>
                  <p className="text-sm text-[#454c56] whitespace-pre-line leading-relaxed">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-[#e4e8ee] pt-5 text-center">
            <p className="text-sm font-medium text-[#1769e0]">{COMPANY.tagline}</p>
            <p className="text-xs text-[#9aa2ad] mt-1">{COMPANY.website} &middot; {COMPANY.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/80 bg-card p-4 print:hidden">
        <p className="text-xs font-medium text-muted-foreground mb-2.5">Activity</p>
        <AuditTrail entityType="invoice" entityId={invoice._id} refreshKey={refreshKey} />
      </div>

      <InvoiceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={invoice}
        onSaved={(updated) => {
          setInvoice(updated);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
