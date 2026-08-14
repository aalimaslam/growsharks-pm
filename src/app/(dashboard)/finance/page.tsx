"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Search,
  Paperclip,
  Repeat,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { FinanceEntryJSON, RecurrenceInterval } from "@/types";
import { financeStatusColors, reimbursementColors } from "@/lib/badgeColors";
import { CHART_INCOME_COLOR, CHART_EXPENSE_COLOR } from "@/lib/chartColors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiTile } from "@/components/KpiTile";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { SimpleDonutChart } from "@/components/charts/SimpleDonutChart";
import { FinanceEntryDialog } from "@/components/finance/FinanceEntryDialog";

const currency = (n: number) =>
  n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function addInterval(date: Date, interval: RecurrenceInterval): Date {
  const d = new Date(date);
  if (interval === "weekly") d.setDate(d.getDate() + 7);
  else if (interval === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export default function FinancePage() {
  const [entries, setEntries] = useState<FinanceEntryJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntryJSON | null>(null);
  const [duplicateSeed, setDuplicateSeed] = useState<Partial<FinanceEntryJSON> | null>(null);

  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (status !== "all") params.set("status", status);
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      if (search) params.set("q", search);

      const data = await apiFetch<FinanceEntryJSON[]>(`/api/finance?${params.toString()}`);
      setEntries(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load finance entries");
    } finally {
      setLoading(false);
    }
  }, [type, status, from, to, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const e of entries) {
      if (e.type === "income") income += e.amount;
      else expense += e.amount;
    }
    return { income, expense, net: income - expense };
  }, [entries]);

  const monthlyTrend = useMemo(() => {
    const buckets = new Map<string, { income: number; expense: number }>();
    for (const e of entries) {
      const d = new Date(e.date);
      const key = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      if (!buckets.has(key)) buckets.set(key, { income: 0, expense: 0 });
      const b = buckets.get(key)!;
      if (e.type === "income") b.income += e.amount;
      else b.expense += e.amount;
    }
    return [...buckets.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([month, v]) => ({ month, ...v }));
  }, [entries]);

  const categoryBreakdown = useCallback(
    (t: "income" | "expense") => {
      const map = new Map<string, number>();
      for (const e of entries) {
        if (e.type !== t) continue;
        map.set(e.category, (map.get(e.category) || 0) + e.amount);
      }
      return [...map.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
    [entries]
  );

  const handleSaved = (entry: FinanceEntryJSON) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e._id === entry._id);
      return exists ? prev.map((e) => (e._id === entry._id ? entry : e)) : [entry, ...prev];
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await apiFetch(`/api/finance/${id}`, { method: "DELETE" });
      setEntries((prev) => prev.filter((e) => e._id !== id));
      toast.success("Entry deleted");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete entry");
    }
  };

  const openEdit = async (entry: FinanceEntryJSON) => {
    setDuplicateSeed(null);
    if (!entry.attachment) {
      setEditing(entry);
      setDialogOpen(true);
      return;
    }
    // List rows omit the attachment's data URL for load performance; fetch
    // the full entry so the edit dialog doesn't silently drop the receipt.
    try {
      const full = await apiFetch<FinanceEntryJSON>(`/api/finance/${entry._id}`);
      setEditing(full);
      setDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load entry");
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
      toast.error(err instanceof ApiClientError ? err.message : "Failed to download attachment");
    }
  };

  const duplicateForNextPeriod = (entry: FinanceEntryJSON) => {
    const interval = entry.recurrenceInterval || "monthly";
    setDuplicateSeed({ ...entry, date: addInterval(new Date(entry.date), interval).toISOString() });
    setEditing(null);
    setDialogOpen(true);
  };

  const dialogInitial = editing
    ? {
        _id: editing._id,
        type: editing.type,
        amount: String(editing.amount),
        category: editing.category,
        description: editing.description,
        date: editing.date.slice(0, 10),
        status: editing.status,
        isRecurring: editing.isRecurring,
        recurrenceInterval: editing.recurrenceInterval || "monthly",
        attachment: editing.attachment,
      }
    : duplicateSeed
      ? {
          type: duplicateSeed.type,
          amount: String(duplicateSeed.amount),
          category: duplicateSeed.category,
          description: duplicateSeed.description,
          date: (duplicateSeed.date as string).slice(0, 10),
          status: duplicateSeed.status,
          isRecurring: duplicateSeed.isRecurring,
          recurrenceInterval: duplicateSeed.recurrenceInterval || "monthly",
          attachment: null,
        }
      : undefined;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">Company income & expenses — visible to admins only</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDuplicateSeed(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> Add entry
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile icon={TrendingUp} label="Income (filtered)" value={currency(totals.income)} accent="blue" />
        <KpiTile icon={TrendingDown} label="Expenses (filtered)" value={currency(totals.expense)} accent="pink" />
        <KpiTile
          icon={Wallet}
          label="Net"
          value={currency(totals.net)}
          accent={totals.net >= 0 ? "cyan" : "amber"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Income vs expense by month</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SimpleBarChart
              data={monthlyTrend}
              xKey="month"
              series={[
                { key: "income", label: "Income", color: CHART_INCOME_COLOR },
                { key: "expense", label: "Expense", color: CHART_EXPENSE_COLOR },
              ]}
            />
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SimpleDonutChart data={categoryBreakdown("expense")} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Description..."
              className="pl-8 h-8 text-sm rounded-md"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select value={type} onValueChange={(v) => setType(v || "all")}>
            <SelectTrigger className="h-8 text-sm rounded-md w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v || "all")}>
            <SelectTrigger className="h-8 text-sm rounded-md w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-sm rounded-md w-32" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-sm rounded-md w-32" />
        </div>
        {(type !== "all" || status !== "all" || search || from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setType("all");
              setStatus("all");
              setSearch("");
              setFrom("");
              setTo("");
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
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Date</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Type</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Category</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Description</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10">Status</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10 text-right">Amount</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No entries match these filters.
                </TableCell>
              </TableRow>
            )}
            {entries.map((e) => (
              <TableRow key={e._id} className="group">
                <TableCell className="whitespace-nowrap text-sm">{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "capitalize border-transparent text-[11px] px-1.5 py-0.5",
                      e.type === "income" ? "bg-accent-blue-soft text-accent-blue" : "bg-accent-pink-soft text-accent-pink"
                    )}
                  >
                    {e.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{e.category}</TableCell>
                <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {e.description || "—"}
                    {e.isRecurring && <Repeat className="size-3 shrink-0" />}
                    {e.attachment && <Paperclip className="size-3 shrink-0" />}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge className={cn("capitalize border-transparent text-[11px] px-1.5 py-0.5", financeStatusColors[e.status])}>{e.status}</Badge>
                    {e.reimbursable && (
                      <Badge
                        className={cn(
                          "capitalize border-transparent text-[11px] px-1.5 py-0.5",
                          reimbursementColors[e.reimbursed ? "reimbursed" : "pending"]
                        )}
                        title={e.reimbursed ? "Reimbursed" : "Awaiting reimbursement"}
                      >
                        {e.reimbursed ? "Reimbursed" : "To reimburse"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums text-sm",
                    e.type === "income" ? "text-accent-blue" : "text-accent-pink"
                  )}
                >
                  {e.type === "income" ? "+" : "-"}
                  {currency(e.amount)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {e.attachment && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        title="Download attachment"
                        onClick={() => downloadAttachment(e)}
                      >
                        <Download className="size-3.5" />
                      </Button>
                    )}
                    {e.isRecurring && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        title="Duplicate for next period"
                        onClick={() => duplicateForNextPeriod(e)}
                      >
                        <Repeat className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      onClick={() => openEdit(e)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="size-7 text-destructive hover:text-destructive" onClick={() => remove(e._id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FinanceEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={dialogInitial} onSaved={handleSaved} />
    </div>
  );
}
