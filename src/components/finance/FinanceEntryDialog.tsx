"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { FinanceEntryJSON, FinanceType, RecurrenceInterval } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = ["Salaries", "Software & Tools", "Marketing & Ads", "Rent & Utilities", "Equipment", "Contractors", "Other"];
const INCOME_CATEGORIES = ["Client Payment", "Retainer", "Other"];
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

interface FormState {
  type: FinanceType;
  amount: string;
  category: string;
  description: string;
  date: string;
  status: "paid" | "pending" | "overdue";
  isRecurring: boolean;
  recurrenceInterval: RecurrenceInterval;
  attachment: { dataUrl: string; name: string; mimeType: string } | null;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(type: FinanceType = "expense"): FormState {
  return {
    type,
    amount: "",
    category: "",
    description: "",
    date: todayISODate(),
    status: "paid",
    isRecurring: false,
    recurrenceInterval: "monthly",
    attachment: null,
  };
}

interface FinanceEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<FormState> & { _id?: string };
  onSaved: (entry: FinanceEntryJSON) => void;
}

export function FinanceEntryDialog({ open, onOpenChange, initial, onSaved }: FinanceEntryDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm(initial?.type), ...initial });
    }
  }, [open, initial]);

  const categories = form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Attachment must be under 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, attachment: { dataUrl: String(reader.result), name: file.name, mimeType: file.type } }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        type: form.type,
        amount,
        category: form.category.trim(),
        description: form.description.trim(),
        date: new Date(form.date).toISOString(),
        status: form.status,
        isRecurring: form.isRecurring,
        recurrenceInterval: form.isRecurring ? form.recurrenceInterval : null,
        attachment: form.attachment,
      };

      const entry = initial?._id
        ? await apiFetch<FinanceEntryJSON>(`/api/finance/${initial._id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch<FinanceEntryJSON>("/api/finance", { method: "POST", body: JSON.stringify(body) });

      toast.success(initial?._id ? "Entry updated" : `${form.type === "income" ? "Income" : "Expense"} entry added`);
      onSaved(entry);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save entry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>{initial?._id ? "Edit entry" : "New finance entry"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-md border p-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t, category: "" }))}
                className={cn(
                  "rounded-sm py-1.5 text-sm font-medium capitalize transition-colors",
                  form.type === t
                    ? t === "income"
                      ? "bg-accent-blue-soft text-accent-blue"
                      : "bg-accent-pink-soft text-accent-pink"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount" className="text-xs font-medium">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date" className="text-xs font-medium">Date</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-8 text-sm rounded-md" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category" className="text-xs font-medium">Category</Label>
            <Input
              id="category"
              list="finance-categories"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Select or type a category"
              className="h-8 text-sm rounded-md"
            />
            <datalist id="finance-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description" className="text-xs font-medium">Description</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="text-sm rounded-md"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as FormState["status"] }))}>
              <SelectTrigger className="h-8 text-sm rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={form.isRecurring}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isRecurring: !!v }))}
              />
              Recurring entry
            </label>
            {form.isRecurring && (
              <Select
                value={form.recurrenceInterval}
                onValueChange={(v) => setForm((f) => ({ ...f, recurrenceInterval: v as RecurrenceInterval }))}
              >
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Receipt / attachment (optional, max 4MB)</Label>
            {form.attachment ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 truncate">
                  <Paperclip className="size-3.5 shrink-0" /> {form.attachment.name}
                </span>
                <button type="button" onClick={() => setForm((f) => ({ ...f, attachment: null }))}>
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFile(e.target.files?.[0])} className="text-sm rounded-md" />
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} size="sm">
            {submitting ? "Saving..." : initial?._id ? "Save changes" : "Add entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
