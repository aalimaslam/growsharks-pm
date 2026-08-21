"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, Eye, Pencil, Trash2, FileText, Clock, AlertCircle } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { formatMoney } from "@/lib/invoice";
import type { InvoiceJSON, InvoiceStatus } from "@/types";
import { invoiceStatusColors } from "@/lib/badgeColors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiTile } from "@/components/KpiTile";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceJSON | null>(null);

  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (search) params.set("q", search);
      const data = await apiFetch<InvoiceJSON[]>(`/api/invoices?${params.toString()}`);
      setInvoices(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let paid = 0;
    let overdueCount = 0;
    for (const inv of invoices) {
      if (inv.status === "sent" || inv.status === "overdue") outstanding += inv.total;
      if (inv.status === "paid") paid += inv.total;
      if (inv.status === "overdue") overdueCount += 1;
    }
    return { outstanding, paid, overdueCount };
  }, [invoices]);

  const handleSaved = (invoice: InvoiceJSON) => {
    setInvoices((prev) => {
      const exists = prev.some((i) => i._id === invoice._id);
      return exists ? prev.map((i) => (i._id === invoice._id ? invoice : i)) : [invoice, ...prev];
    });
  };

  const remove = async (invoice: InvoiceJSON) => {
    if (!confirm(`Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/invoices/${invoice._id}`, { method: "DELETE" });
      setInvoices((prev) => prev.filter((i) => i._id !== invoice._id));
      toast.success("Invoice deleted");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete invoice");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Create, send, and track client invoices</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> New invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile icon={FileText} label="Outstanding" value={formatMoney(totals.outstanding, "INR")} accent="blue" />
        <KpiTile icon={Clock} label="Paid" value={formatMoney(totals.paid, "INR")} accent="cyan" />
        <KpiTile icon={AlertCircle} label="Overdue invoices" value={String(totals.overdueCount)} accent="pink" />
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice # or client..."
              className="pl-8 h-8 text-sm rounded-md w-56"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v || "all")}>
            <SelectTrigger className="h-8 text-sm rounded-md w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(status !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("all");
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border/80 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Invoice #</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Client</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Issued</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Due</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Status</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10 text-right">Total</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No invoices match these filters.
                </TableCell>
              </TableRow>
            )}
            {invoices.map((inv) => (
              <TableRow key={inv._id} className="group">
                <TableCell className="whitespace-nowrap text-sm font-medium">
                  <Link href={`/invoices/${inv._id}`} className="hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm">{inv.client.name}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(inv.issueDate).toLocaleDateString()}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(inv.dueDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge className={cn("capitalize border-transparent text-[11px] px-1.5 py-0.5", invoiceStatusColors[inv.status as InvoiceStatus])}>
                    {inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-sm">
                  {formatMoney(inv.total, inv.currency)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link href={`/invoices/${inv._id}`}>
                      <Button variant="ghost" size="icon-sm" className="size-7" title="View / print">
                        <Eye className="size-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      title="Edit"
                      onClick={() => {
                        setEditing(inv);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => remove(inv)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSaved={handleSaved} />
    </div>
  );
}
