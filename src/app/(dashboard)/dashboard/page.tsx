import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminDashboardData, getEmployeeDashboardData } from "@/lib/dashboardData";
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

function formatINR(amount: number) {
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id: userId, role, name } = session.user;

  if (role === "admin") {
    const d = await getAdminDashboardData();

    const stats = [
      { label: "Projects", value: d.projectCount, icon: FolderKanban, accent: "blue" as const },
      { label: "Employees", value: d.employeeCount, icon: Users, accent: "violet" as const },
      { label: "Open tasks", value: d.openTasksCount, icon: ListTodo, accent: "cyan" as const },
      { label: "Overdue tasks", value: d.overdueCount, icon: AlertTriangle, accent: "pink" as const, warn: d.overdueCount > 0 },
      { label: "Completed this week", value: d.completedThisWeek, icon: CheckCircle2, accent: "cyan" as const },
      { label: "Hours logged (month)", value: d.hoursThisMonth.toFixed(1), icon: Clock, accent: "violet" as const },
      {
        label: "Net profit (month)",
        value: formatINR(d.netThisMonth),
        icon: Wallet,
        accent: d.netThisMonth >= 0 ? ("blue" as const) : ("pink" as const),
      },
      { label: "Task completion rate", value: `${d.completionRate}%`, icon: Target, accent: "amber" as const },
    ];

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
                  <div className="text-base font-semibold tabular-nums">{d.projectCount}</div>
                  <div className="text-xs text-muted-foreground">Projects</div>
                </div>
                <div className="px-3 py-1.5">
                  <div className="text-base font-semibold tabular-nums">{d.openTasksCount}</div>
                  <div className="text-xs text-muted-foreground">Open</div>
                </div>
                <div className="px-3 py-1.5">
                  <div className="text-base font-semibold tabular-nums">{d.completionRate}%</div>
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
                data={d.weekBuckets}
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
              <SimpleDonutChart data={d.statusData} height={180} />
            </CardContent>
          </Card>
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Hours logged by employee (top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleBarChart
                data={d.hoursByEmployee}
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
                data={d.financeTrend}
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
              {d.recentProjects.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No projects yet. <Link href="/projects" className="underline">Create one</Link>.
                </p>
              )}
              {d.recentProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
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
  const now = new Date();
  const d = await getEmployeeDashboardData(userId);

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
        <KpiTile icon={ListTodo} label="Open tasks" value={d.openTasksCount} accent="blue" />
        <KpiTile icon={AlertTriangle} label="Overdue" value={d.overdueCount} accent="pink" warn={d.overdueCount > 0} />
        <KpiTile icon={Clock} label="Hours this week" value={d.hoursThisWeek.toFixed(1)} accent="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My open tasks by priority</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={d.priorityData}
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
          {d.myTasks.length === 0 && <p className="text-sm text-muted-foreground py-4">Nothing assigned to you right now.</p>}
          {d.myTasks.map((t) => {
            const dueDate = t.dueDate ? new Date(t.dueDate) : null;
            const overdue = dueDate && dueDate < now;
            return (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-muted/55"
              >
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.projectName}</div>
                </div>
                <div className="flex items-center gap-2">
                  {dueDate && (
                    <span className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {dueDate.toLocaleDateString()}
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
