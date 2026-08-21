"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { computeInvoiceTotals, formatMoney } from "@/lib/invoice";
import type { InvoiceJSON, InvoiceStatus, ProjectJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];

interface ItemForm {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface FormState {
  client: { name: string; email: string; phone: string; address: string };
  project: string;
  items: ItemForm[];
  currency: string;
  taxRate: string;
  discount: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string;
  terms: string;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function dueInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function emptyItem(): ItemForm {
  return { description: "", quantity: "1", unitPrice: "" };
}

function emptyForm(): FormState {
  return {
    client: { name: "", email: "", phone: "", address: "" },
    project: "",
    items: [emptyItem()],
    currency: "INR",
    taxRate: "0",
    discount: "0",
    issueDate: todayISODate(),
    dueDate: dueInDays(15),
    status: "draft",
    notes: "",
    terms: "Payment due within 15 days of the invoice date.",
  };
}

function fromInvoice(inv: InvoiceJSON): FormState {
  return {
    client: { name: inv.client.name, email: inv.client.email, phone: inv.client.phone, address: inv.client.address },
    project: typeof inv.project === "string" ? inv.project : inv.project?._id || "",
    items: inv.items.length
      ? inv.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
      : [emptyItem()],
    currency: inv.currency,
    taxRate: String(inv.taxRate),
    discount: String(inv.discount),
    issueDate: inv.issueDate.slice(0, 10),
    dueDate: inv.dueDate.slice(0, 10),
    status: inv.status,
    notes: inv.notes,
    terms: inv.terms,
  };
}

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: InvoiceJSON | null;
  onSaved: (invoice: InvoiceJSON) => void;
}

export function InvoiceDialog({ open, onOpenChange, initial, onSaved }: InvoiceDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [projects, setProjects] = useState<ProjectJSON[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromInvoice(initial) : emptyForm());
      apiFetch<ProjectJSON[]>("/api/projects").then(setProjects).catch(() => setProjects([]));
    }
  }, [open, initial]);

  const parsedItems = useMemo(
    () =>
      form.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
      })),
    [form.items]
  );

  const totals = useMemo(
    () => computeInvoiceTotals(parsedItems, Number(form.taxRate) || 0, Number(form.discount) || 0),
    [parsedItems, form.taxRate, form.discount]
  );

  const updateItem = (index: number, patch: Partial<ItemForm>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (index: number) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items }));

  const submit = async () => {
    if (!form.client.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    const items = parsedItems.filter((i) => i.description.trim());
    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (items.some((i) => i.quantity <= 0 || i.unitPrice < 0)) {
      toast.error("Check item quantities and prices");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        client: {
          name: form.client.name.trim(),
          email: form.client.email.trim(),
          phone: form.client.phone.trim(),
          address: form.client.address.trim(),
        },
        project: form.project || null,
        items,
        currency: form.currency,
        taxRate: Number(form.taxRate) || 0,
        discount: Number(form.discount) || 0,
        issueDate: new Date(form.issueDate).toISOString(),
        dueDate: new Date(form.dueDate).toISOString(),
        status: form.status,
        notes: form.notes.trim(),
        terms: form.terms.trim(),
      };

      const invoice = initial
        ? await apiFetch<InvoiceJSON>(`/api/invoices/${initial._id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch<InvoiceJSON>("/api/invoices", { method: "POST", body: JSON.stringify(body) });

      toast.success(initial ? "Invoice updated" : `Invoice ${invoice.invoiceNumber} created`);
      onSaved(invoice);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.invoiceNumber}` : "New invoice"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Client name</Label>
              <Input
                value={form.client.name}
                onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, name: e.target.value } }))}
                placeholder="Acme Retail Pvt Ltd"
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Client email</Label>
              <Input
                type="email"
                value={form.client.email}
                onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, email: e.target.value } }))}
                placeholder="billing@client.com"
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Client phone</Label>
              <Input
                value={form.client.phone}
                onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, phone: e.target.value } }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Linked project (optional)</Label>
              <Select value={form.project || "none"} onValueChange={(v) => setForm((f) => ({ ...f, project: v === "none" ? "" : v || "" }))}>
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Client billing address</Label>
            <Textarea
              rows={2}
              value={form.client.address}
              onChange={(e) => setForm((f) => ({ ...f, client: { ...f.client, address: e.target.value } }))}
              className="text-sm rounded-md"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Line items</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
                <Plus className="size-3.5" /> Add item
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_4.5rem_5.5rem_auto] gap-2 items-center">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder="Description"
                    className="h-8 text-sm rounded-md"
                  />
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                    placeholder="Qty"
                    className="h-8 text-sm rounded-md"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                    placeholder="Rate"
                    className="h-8 text-sm rounded-md"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => removeItem(i)}
                    disabled={form.items.length === 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v || "INR" }))}>
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Tax %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxRate}
                onChange={(e) => setForm((f) => ({ ...f, taxRate: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Discount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as InvoiceStatus }))}>
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Issue date</Label>
              <Input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Notes (visible to client)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Thanks for your business!"
              className="text-sm rounded-md"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Terms</Label>
            <Textarea
              rows={2}
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              className="text-sm rounded-md"
            />
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2.5 flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatMoney(totals.subtotal, form.currency)}</span>
            </div>
            {Number(form.discount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatMoney(Number(form.discount) || 0, form.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({Number(form.taxRate) || 0}%)</span>
              <span>{formatMoney(totals.taxAmount, form.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground pt-1 border-t mt-1">
              <span>Total</span>
              <span>{formatMoney(totals.total, form.currency)}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} size="sm">
            {submitting ? "Saving..." : initial ? "Save changes" : "Create invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
