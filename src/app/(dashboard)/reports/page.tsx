import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Project } from "@/models/Project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { KpiTile } from "@/components/KpiTile";
import { Clock } from "lucide-react";

interface Row {
  userId: string;
  projectId: string;
  hours: number;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const { from, to } = await searchParams;
  await connectDB();

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const tasks = await Task.find(
    {},
    { project: 1, timeLogs: 1 }
  ).lean();

  const rows: Row[] = [];
  for (const task of tasks) {
    for (const log of task.timeLogs) {
      if (fromDate && log.date < fromDate) continue;
      if (toDate && log.date > toDate) continue;
      rows.push({ userId: log.user.toString(), projectId: task.project.toString(), hours: log.hours });
    }
  }

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  const [users, projects] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("name"),
    Project.find({ _id: { $in: projectIds } }).select("name"),
  ]);
  const userName = new Map(users.map((u) => [u._id.toString(), u.name]));
  const projectName = new Map(projects.map((p) => [p._id.toString(), p.name]));

  const byUser = new Map<string, number>();
  const byProject = new Map<string, number>();
  const grid = new Map<string, Map<string, number>>(); // userId -> projectId -> hours

  for (const r of rows) {
    byUser.set(r.userId, (byUser.get(r.userId) || 0) + r.hours);
    byProject.set(r.projectId, (byProject.get(r.projectId) || 0) + r.hours);
    if (!grid.has(r.userId)) grid.set(r.userId, new Map());
    const userRow = grid.get(r.userId)!;
    userRow.set(r.projectId, (userRow.get(r.projectId) || 0) + r.hours);
  }

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const sortedUserIds = [...byUser.keys()].sort((a, b) => (byUser.get(b) || 0) - (byUser.get(a) || 0));
  const sortedProjectIds = [...byProject.keys()].sort((a, b) => (byProject.get(b) || 0) - (byProject.get(a) || 0));

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Time reports</h1>
        <p className="text-sm text-muted-foreground">Hours logged across all projects</p>
      </div>

      <form className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
      </form>

      <div className="max-w-xs">
        <KpiTile icon={Clock} label="Total hours logged" value={`${totalHours.toFixed(1)}h`} accent="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By employee &times; project</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sortedUserIds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No time logged in this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  {sortedProjectIds.map((pid) => (
                    <TableHead key={pid}>{projectName.get(pid) || "Unknown"}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUserIds.map((uid) => (
                  <TableRow key={uid}>
                    <TableCell className="font-medium">{userName.get(uid) || "Unknown"}</TableCell>
                    {sortedProjectIds.map((pid) => (
                      <TableCell key={pid}>{(grid.get(uid)?.get(pid) || 0).toFixed(1)}</TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{(byUser.get(uid) || 0).toFixed(1)}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
