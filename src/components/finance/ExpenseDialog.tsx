"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Paperclip, X } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { FinanceAttachmentJSON, FinanceEntryJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const EXPENSE_CATEGORIES = ["Travel", "Meals", "Office Supplies", "Software & Tools", "Client Entertainment", "Other"];
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

interface FormState {
  amount: string;
  category: string;
  description: string;
  date: string;
  attachment: FinanceAttachmentJSON | null;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return { amount: "", category: "", description: "", date: todayISODate(), attachment: null };
}

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: FinanceEntryJSON | null;
  onSaved: (entry: FinanceEntryJSON) => void;
}

export function ExpenseDialog({ open, onOpenChange, initial, onSaved }: ExpenseDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            amount: String(initial.amount),
            category: initial.category,
            description: initial.description,
            date: initial.date.slice(0, 10),
            attachment: initial.attachment,
          }
        : emptyForm()
    );
  }, [open, initial]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Receipt must be under 4MB");
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
        type: "expense" as const,
        amount,
        category: form.category.trim(),
        description: form.description.trim(),
        date: new Date(form.date).toISOString(),
        attachment: form.attachment,
      };

      const entry = initial
        ? await apiFetch<FinanceEntryJSON>(`/api/finance/${initial._id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch<FinanceEntryJSON>("/api/finance", { method: "POST", body: JSON.stringify(body) });

      toast.success(initial ? "Expense updated" : "Expense submitted");
      onSaved(entry);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit expense" : "New expense"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense-amount" className="text-xs font-medium">Amount</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expense-date" className="text-xs font-medium">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-category" className="text-xs font-medium">Category</Label>
            <Input
              id="expense-category"
              list="expense-categories"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Select or type a category"
              className="h-8 text-sm rounded-md"
            />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expense-description" className="text-xs font-medium">Description</Label>
            <Textarea
              id="expense-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="text-sm rounded-md"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Receipt (optional, max 4MB)</Label>
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
            {submitting ? "Saving..." : initial ? "Save changes" : "Submit expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
