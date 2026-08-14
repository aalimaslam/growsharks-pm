"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Plus, Paperclip, Pencil, Trash2, Download, ReceiptText, CheckCircle2, RotateCcw, History } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { FinanceEntryJSON, UserJSON } from "@/types";
import { reimbursementColors } from "@/lib/badgeColors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiTile } from "@/components/KpiTile";
import { ExpenseDialog } from "@/components/finance/ExpenseDialog";
import { AuditTrail } from "@/components/AuditTrail";

const currency = (n: number, c: string) =>
  n.toLocaleString("en-IN", { style: "currency", currency: c || "INR", maximumFractionDigits: 0 });

function personName(value: UserJSON | string | null, fallbackIsMe: string | undefined, myId?: string): string {
  if (!value) return "";
  if (typeof value === "object") return value.name;
  return value === myId ? fallbackIsMe || "You" : "—";
}

export default function ExpensesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const myId = session?.user?.id;

  const [entries, setEntries] = useState<FinanceEntryJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "pending" | "reimbursed">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntryJSON | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ reimbursable: "true" });
      if (tab === "pending") params.set("reimbursed", "false");
      if (tab === "reimbursed") params.set("reimbursed", "true");
      const data = await apiFetch<FinanceEntryJSON[]>(`/api/finance?${params.toString()}`);
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = entries.filter((e) => !e.reimbursed).length;
  const pendingTotal = entries.filter((e) => !e.reimbursed).reduce((s, e) => s + e.amount, 0);
  const reimbursedTotal = entries.filter((e) => e.reimbursed).reduce((s, e) => s + e.amount, 0);

  const isOwner = (e: FinanceEntryJSON) => (typeof e.createdBy === "object" ? e.createdBy._id : e.createdBy) === myId;
  const canEdit = (e: FinanceEntryJSON) => isAdmin || (isOwner(e) && !e.reimbursed);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = async (entry: FinanceEntryJSON) => {
    if (!entry.attachment) {
      setEditing(entry);
      setDialogOpen(true);
      return;
    }
    try {
      const full = await apiFetch<FinanceEntryJSON>(`/api/finance/${entry._id}`);
      setEditing(full);
      setDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load entry");
    }
  };

  const handleSaved = (entry: FinanceEntryJSON) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e._id === entry._id);
      return exists ? prev.map((e) => (e._id === entry._id ? entry : e)) : [entry, ...prev];
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiFetch(`/api/finance/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e._id !== id));
      toast.success("Expense deleted");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete expense");
    }
  };

  const toggleReimburse = async (entry: FinanceEntryJSON) => {
    try {
      const updated = await apiFetch<FinanceEntryJSON>(`/api/finance/${entry._id}/reimburse`, {
        method: "POST",
        body: JSON.stringify({ reimbursed: !entry.reimbursed }),
      });
      setEntries((prev) => prev.map((e) => (e._id === entry._id ? updated : e)));
      toast.success(updated.reimbursed ? "Marked as reimbursed" : "Reimbursement reverted");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update reimbursement");
    }
  };

  const downloadAttachment = async (entry: FinanceEntryJSON) => {
    if (!entry.attachment) return;
    try {
      const full = entry.attachment.dataUrl ? entry : await apiFetch<FinanceEntryJSON>(`/api/finance/${entry._id}`);
      if (!full.attachment?.dataUrl) return;
      const a = document.createElement("a");
      a.href = full.attachment.dataUrl;
      a.download = full.attachment.name;
      a.click();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to download receipt");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isAdmin ? "Expense reimbursements" : "My expenses"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Out-of-pocket expenses submitted by the team, waiting on reimbursement."
              : "Submit expenses you've paid out of pocket and track reimbursement."}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4 mr-1.5" /> Add expense
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile icon={ReceiptText} label="Awaiting reimbursement" value={pendingCount} accent="amber" warn={pendingCount > 0} />
        <KpiTile icon={ReceiptText} label="Pending amount" value={currency(pendingTotal, "INR")} accent="amber" />
        <KpiTile icon={CheckCircle2} label="Reimbursed" value={currency(reimbursedTotal, "INR")} accent="cyan" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="reimbursed">Reimbursed</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium text-muted-foreground h-10">Date</TableHead>
                {isAdmin && <TableHead className="text-xs font-medium text-muted-foreground h-10">Employee</TableHead>}
                <TableHead className="text-xs font-medium text-muted-foreground h-10">Category</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground h-10">Description</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground h-10 text-right">Amount</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground h-10">Status</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground h-10">Reimbursed by</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground h-10 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 8 : 7} className="text-center text-muted-foreground py-10">
                    No expenses here yet.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => (
                <TableRow key={e._id} className="group">
                  <TableCell className="whitespace-nowrap text-sm">{new Date(e.date).toLocaleDateString()}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-sm">{typeof e.createdBy === "object" ? e.createdBy.name : "—"}</TableCell>
                  )}
                  <TableCell className="text-sm">{e.category}</TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      {e.description || "—"}
                      {e.attachment && <Paperclip className="size-3 shrink-0" />}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-sm">{currency(e.amount, e.currency)}</TableCell>
                  <TableCell>
                    <Badge className={cn("capitalize border-transparent text-[11px] px-1.5 py-0.5", reimbursementColors[e.reimbursed ? "reimbursed" : "pending"])}>
                      {e.reimbursed ? "Reimbursed" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.reimbursed ? personName(e.reimbursedBy, "You", myId) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {(isAdmin || isOwner(e)) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          title={e.reimbursed ? "Revert reimbursement" : "Mark reimbursed"}
                          onClick={() => toggleReimburse(e)}
                        >
                          {e.reimbursed ? <RotateCcw className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                        </Button>
                      )}
                      {e.attachment && (
                        <Button variant="ghost" size="icon-sm" className="size-7" title="Download receipt" onClick={() => downloadAttachment(e)}>
                          <Download className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" className="size-7" title="History" onClick={() => setHistoryId(e._id)}>
                        <History className="size-3.5" />
                      </Button>
                      {canEdit(e) && (
                        <Button variant="ghost" size="icon-sm" className="size-7" title="Edit" onClick={() => openEdit(e)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {canEdit(e) && (
                        <Button variant="ghost" size="icon-sm" className="size-7 text-destructive hover:text-destructive" title="Delete" onClick={() => remove(e._id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ExpenseDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSaved={handleSaved} />

      <Dialog open={!!historyId} onOpenChange={(open) => !open && setHistoryId(null)}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>Expense history</DialogTitle>
          </DialogHeader>
          {historyId && <AuditTrail entityType="finance" entityId={historyId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
