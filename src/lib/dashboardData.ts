import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Project, DONE_COLUMN_IDS } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { FinanceEntry } from "@/models/FinanceEntry";
import { withCache } from "@/lib/cache";

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

export interface AdminDashboardData {
  projectCount: number;
  employeeCount: number;
  openTasksCount: number;
  overdueCount: number;
  completedThisWeek: number;
  completionRate: number;
  hoursThisMonth: number;
  incomeThisMonth: number;
  expenseThisMonth: number;
  netThisMonth: number;
  recentProjects: { id: string; name: string; status: string }[];
  statusData: { name: string; value: number }[];
  weekBuckets: { week: string; completed: number }[];
  financeTrend: { month: string; income: number; expense: number }[];
  hoursByEmployee: { name: string; hours: number }[];
}

// Every dashboard number is "as of a few seconds ago" by nature (aggregate
// stats, not a live board), so a flat TTL with no explicit invalidation is
// the pragmatic choice here — the alternative would be busting this cache
// from nearly every task/project/finance/user mutation in the app.
async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  await connectDB();
  const now = new Date();
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
    Project.find().sort({ createdAt: -1 }).limit(6).select("name status").lean(),
    Task.aggregate([{ $group: { _id: "$columnId", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Task.find({ completedAt: { $gte: eightWeeksAgo } }).select("completedAt").lean(),
    FinanceEntry.aggregate([
      { $match: { date: { $gte: startOfMonth(now) } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
    FinanceEntry.find({ date: { $gte: sixMonthsAgo } }).select("type amount date").lean(),
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

  const statusData = statusBreakdown.map((s) => ({ name: String(s._id).replace(/-/g, " "), value: s.count }));

  const weekBuckets: { week: string; completed: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const count = completedTasksRecent.filter((t) => {
      const c = t.completedAt as Date | null;
      return c && c >= weekStart && c < weekEnd;
    }).length;
    weekBuckets.push({ week: label, completed: count });
  }

  const monthMap = new Map<string, { income: number; expense: number }>();
  for (const f of financeLast6Months) {
    const key = monthLabel(f.date as Date);
    if (!monthMap.has(key)) monthMap.set(key, { income: 0, expense: 0 });
    const bucket = monthMap.get(key)!;
    if (f.type === "income") bucket.income += f.amount;
    else bucket.expense += f.amount;
  }
  const financeTrend = [...monthMap.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([month, v]) => ({ month, ...v }));

  const employeeIds = hoursByEmployeeAgg.map((h) => h._id).filter(Boolean);
  const employeeDocs = await User.find({ _id: { $in: employeeIds } }).select("name").lean();
  const employeeNameMap = new Map(employeeDocs.map((u) => [u._id.toString(), u.name]));
  const hoursByEmployee = hoursByEmployeeAgg.map((h) => ({
    name: employeeNameMap.get(String(h._id)) || "Unknown",
    hours: Math.round(h.hours * 10) / 10,
  }));

  return {
    projectCount,
    employeeCount,
    openTasksCount,
    overdueCount,
    completedThisWeek,
    completionRate,
    hoursThisMonth,
    incomeThisMonth,
    expenseThisMonth,
    netThisMonth: incomeThisMonth - expenseThisMonth,
    recentProjects: recentProjects.map((p) => ({ id: p._id.toString(), name: p.name, status: p.status })),
    statusData,
    weekBuckets,
    financeTrend,
    hoursByEmployee,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  return withCache("dashboard:admin", 30, fetchAdminDashboardData);
}

export interface EmployeeDashboardData {
  openTasksCount: number;
  overdueCount: number;
  hoursThisWeek: number;
  priorityData: { priority: string; count: number }[];
  myTasks: {
    id: string;
    title: string;
    projectName: string;
    dueDate: string | null;
    priority: "low" | "medium" | "high";
  }[];
}

async function fetchEmployeeDashboardData(userId: string): Promise<EmployeeDashboardData> {
  await connectDB();
  const now = new Date();
  const startWeek = startOfWeek(now);
  const uid = new mongoose.Types.ObjectId(userId);

  const [myTasks, overdueCount, myHoursThisWeekAgg, myPriorityAgg] = await Promise.all([
    Task.find({ assignee: userId, columnId: { $nin: DONE_IDS } })
      .populate("project", "name")
      .select("title dueDate priority project")
      .sort({ dueDate: 1 })
      .limit(15)
      .lean(),
    Task.countDocuments({ assignee: userId, columnId: { $nin: DONE_IDS }, dueDate: { $lt: now } }),
    Task.aggregate([
      { $unwind: "$timeLogs" },
      { $match: { "timeLogs.user": uid, "timeLogs.date": { $gte: startWeek } } },
      { $group: { _id: null, hours: { $sum: "$timeLogs.hours" } } },
    ]),
    Task.aggregate([
      { $match: { assignee: uid, columnId: { $nin: DONE_IDS } } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
  ]);

  const priorityOrder = ["low", "medium", "high"] as const;
  const priorityData = priorityOrder.map((p) => ({
    priority: p,
    count: myPriorityAgg.find((r) => r._id === p)?.count ?? 0,
  }));

  return {
    openTasksCount: myTasks.length,
    overdueCount,
    hoursThisWeek: myHoursThisWeekAgg[0]?.hours ?? 0,
    priorityData,
    myTasks: myTasks.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      projectName: (t.project as unknown as { name: string } | null)?.name || "",
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      priority: t.priority,
    })),
  };
}

export async function getEmployeeDashboardData(userId: string): Promise<EmployeeDashboardData> {
  return withCache(`dashboard:employee:${userId}`, 20, () => fetchEmployeeDashboardData(userId));
}
