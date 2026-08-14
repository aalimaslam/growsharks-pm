import Link from "next/link";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Project, DONE_COLUMN_IDS } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { FinanceEntry } from "@/models/FinanceEntry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiTile } from "@/components/KpiTile";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { SimpleDonutChart } from "@/components/charts/SimpleDonutChart";
import { CHART_INCOME_COLOR, CHART_EXPENSE_COLOR } from "@/lib/chartColors";
import { projectStatusColors, priorityColors } from "@/lib/badgeColors";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  Users,
  ListTodo,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wallet,
  Target,
} from "lucide-react";

const DONE_IDS = [...DONE_COLUMN_IDS];

function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id: userId, role, name } = session.user;

  await connectDB();
  const now = new Date();

  if (role === "admin") {
    const sixMonthsAgo = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const eightWeeksAgo = (() => {
      const d = startOfWeek(now);
      d.setDate(d.getDate() - 7 * 7);
      return d;
    })();

    const [
      projectCount,
      employeeCount,
      openTasksCount,
      overdueCount,
      completedThisWeek,
      totalTasks,
      doneTasks,
      recentProjects,
      statusBreakdown,
      completedTasksRecent,
      financeThisMonth,
      financeLast6Months,
      hoursThisMonthAgg,
      hoursByEmployeeAgg,
    ] = await Promise.all([
      Project.countDocuments(),
      User.countDocuments({ role: "employee", isActive: true }),
      Task.countDocuments({ columnId: { $nin: DONE_IDS } }),
      Task.countDocuments({ columnId: { $nin: DONE_IDS }, dueDate: { $lt: now } }),
      Task.countDocuments({ completedAt: { $gte: startOfWeek(now) } }),
      Task.countDocuments(),
      Task.countDocuments({ columnId: { $in: DONE_IDS } }),
      Project.find().sort({ createdAt: -1 }).limit(6).populate("members", "name"),
      Task.aggregate([{ $group: { _id: "$columnId", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Task.find({ completedAt: { $gte: eightWeeksAgo } }).select("completedAt"),
      FinanceEntry.aggregate([
        { $match: { date: { $gte: startOfMonth(now) } } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),
      FinanceEntry.find({ date: { $gte: sixMonthsAgo } }).select("type amount date"),
      Task.aggregate([
        { $unwind: "$timeLogs" },
        { $match: { "timeLogs.date": { $gte: startOfMonth(now) } } },
        { $group: { _id: null, hours: { $sum: "$timeLogs.hours" } } },
      ]),
      Task.aggregate([
        { $unwind: "$timeLogs" },
        { $group: { _id: "$timeLogs.user", hours: { $sum: "$timeLogs.hours" } } },
        { $sort: { hours: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const hoursThisMonth = hoursThisMonthAgg[0]?.hours ?? 0;

    const incomeThisMonth = financeThisMonth.find((f) => f._id === "income")?.total ?? 0;
    const expenseThisMonth = financeThisMonth.find((f) => f._id === "expense")?.total ?? 0;
    const netThisMonth = incomeThisMonth - expenseThisMonth;

    const stats = [
      { label: "Projects", value: projectCount, icon: FolderKanban, accent: "blue" as const },
      { label: "Employees", value: employeeCount, icon: Users, accent: "violet" as const },
      { label: "Open tasks", value: openTasksCount, icon: ListTodo, accent: "cyan" as const },
      { label: "Overdue tasks", value: overdueCount, icon: AlertTriangle, accent: "pink" as const, warn: overdueCount > 0 },
      { label: "Completed this week", value: completedThisWeek, icon: CheckCircle2, accent: "cyan" as const },
      { label: "Hours logged (month)", value: hoursThisMonth.toFixed(1), icon: Clock, accent: "violet" as const },
      {
        label: "Net profit (month)",
        value: formatINR(netThisMonth),
        icon: Wallet,
        accent: netThisMonth >= 0 ? ("blue" as const) : ("pink" as const),
      },
      { label: "Task completion rate", value: `${completionRate}%`, icon: Target, accent: "amber" as const },
    ];

    // Bucket tasks-by-status into named columns, folding overflow into "Other"
    const statusData = statusBreakdown.map((s) => ({ name: String(s._id).replace(/-/g, " "), value: s.count }));

    // Weekly completion buckets — 8 fixed weeks so quiet weeks still show as 0
    const weekBuckets: { week: string; completed: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const count = completedTasksRecent.filter((t) => {
        const c = t.completedAt as Date;
        return c && c >= weekStart && c < weekEnd;
      }).length;
      weekBuckets.push({ week: label, completed: count });
    }

    // Income vs expense monthly buckets
    const monthMap = new Map<string, { income: number; expense: number }>();
    for (const f of financeLast6Months) {
      const key = monthLabel(f.date);
      if (!monthMap.has(key)) monthMap.set(key, { income: 0, expense: 0 });
      const bucket = monthMap.get(key)!;
      if (f.type === "income") bucket.income += f.amount;
      else bucket.expense += f.amount;
    }
    const financeTrend = [...monthMap.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([month, v]) => ({ month, ...v }));

    const employeeIds = hoursByEmployeeAgg.map((h) => h._id).filter(Boolean);
    const employeeDocs = await User.find({ _id: { $in: employeeIds } }).select("name");
    const employeeNameMap = new Map(employeeDocs.map((u) => [u._id.toString(), u.name]));
    const hoursByEmployee = hoursByEmployeeAgg.map((h) => ({
      name: employeeNameMap.get(String(h._id)) || "Unknown",
      hours: Math.round(h.hours * 10) / 10,
    }));

    return (
      <div className="mx-auto flex w-full max-w-350 flex-col gap-4 p-3 sm:p-4 lg:p-5">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/85">
          <div className="soft-grid px-4 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Admin overview</p>
            <div className="mt-2 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {name?.split(" ")[0]}</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Here&apos;s what&apos;s happening across GrowSharks.</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-card p-1.5 text-center">
                <div className="px-3 py-1.5">
                  <div className="text-base font-semibold tabular-nums">{projectCount}</div>
                  <div className="text-xs text-muted-foreground">Projects</div>
                </div>
                <div className="px-3 py-1.5">
                  <div className="text-base font-semibold tabular-nums">{openTasksCount}</div>
                  <div className="text-xs text-muted-foreground">Open</div>
                </div>
                <div className="px-3 py-1.5">
                  <div className="text-base font-semibold tabular-nums">{completionRate}%</div>
                  <div className="text-xs text-muted-foreground">Done</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <KpiTile key={s.label} icon={s.icon} label={s.label} value={s.value} accent={s.accent} warn={s.warn} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="text-base">Tasks completed per week</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={weekBuckets}
                xKey="week"
                series={[{ key: "completed", label: "Completed", color: "var(--chart-1)" }]}
                height={180}
              />
            </CardContent>
          </Card>
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Tasks by status</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleDonutChart data={statusData} height={180} />
            </CardContent>
          </Card>
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Hours logged by employee (top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={hoursByEmployee}
                xKey="name"
                series={[{ key: "hours", label: "Hours", color: "var(--chart-7)" }]}
                height={180}
              />
            </CardContent>
          </Card>
          <Card className="xl:col-span-8">
            <CardHeader>
              <CardTitle className="text-base">Income vs expense (6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={financeTrend}
                xKey="month"
                series={[
                  { key: "income", label: "Income", color: CHART_INCOME_COLOR },
                  { key: "expense", label: "Expense", color: CHART_EXPENSE_COLOR },
                ]}
                height={200}
              />
            </CardContent>
          </Card>
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Recent projects</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {recentProjects.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No projects yet. <Link href="/projects" className="underline">Create one</Link>.
                </p>
              )}
              {recentProjects.map((p) => (
                <Link
                  key={p._id.toString()}
                  href={`/projects/${p._id}`}
                  className="-mx-2 flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-muted/55"
                >
                  <span className="font-medium text-sm">{p.name}</span>
                  <Badge className={cn("capitalize border-transparent", projectStatusColors[p.status])}>{p.status}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Employee view
  const startWeek = startOfWeek(now);
  const [myTasks, overdueCount, myHoursThisWeekAgg, myPriorityAgg] = await Promise.all([
    Task.find({ assignee: userId, columnId: { $nin: DONE_IDS } })
      .populate("project", "name")
      .sort({ dueDate: 1 })
      .limit(15),
    Task.countDocuments({ assignee: userId, columnId: { $nin: DONE_IDS }, dueDate: { $lt: now } }),
    Task.aggregate([
      { $unwind: "$timeLogs" },
      { $match: { "timeLogs.user": new mongoose.Types.ObjectId(userId), "timeLogs.date": { $gte: startWeek } } },
      { $group: { _id: null, hours: { $sum: "$timeLogs.hours" } } },
    ]),
    Task.aggregate([
      { $match: { assignee: new mongoose.Types.ObjectId(userId), columnId: { $nin: DONE_IDS } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
  ]);

  const myHoursThisWeek = myHoursThisWeekAgg[0]?.hours ?? 0;
  const priorityOrder = ["low", "medium", "high"];
  const priorityData = priorityOrder.map((p) => ({
    priority: p,
    count: myPriorityAgg.find((r) => r._id === p)?.count ?? 0,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 sm:p-4 lg:p-5">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/85">
        <div className="soft-grid px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">My workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {name?.split(" ")[0]}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Here&apos;s what&apos;s on your plate.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile icon={ListTodo} label="Open tasks" value={myTasks.length} accent="blue" />
        <KpiTile icon={AlertTriangle} label="Overdue" value={overdueCount} accent="pink" warn={overdueCount > 0} />
        <KpiTile icon={Clock} label="Hours this week" value={myHoursThisWeek.toFixed(1)} accent="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My open tasks by priority</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={priorityData}
            xKey="priority"
            series={[{ key: "count", label: "Tasks", color: "var(--chart-1)" }]}
            height={180}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My tasks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {myTasks.length === 0 && <p className="text-sm text-muted-foreground py-4">Nothing assigned to you right now.</p>}
          {myTasks.map((t) => {
            const overdue = t.dueDate && t.dueDate < now;
            return (
              <Link
                key={t._id.toString()}
                href={`/tasks/${t._id}`}
                className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-muted/55"
              >
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {(t.project as unknown as { name: string })?.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.dueDate && (
                    <span className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {t.dueDate.toLocaleDateString()}
                    </span>
                  )}
                  <Badge className={cn("capitalize border-transparent", priorityColors[t.priority])}>{t.priority}</Badge>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
