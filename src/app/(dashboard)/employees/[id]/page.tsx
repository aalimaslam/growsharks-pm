import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Task } from "@/models/Task";
import "@/models/Project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { KpiTile } from "@/components/KpiTile";
import { cn } from "@/lib/utils";
import { avatarColorFor, roleColors } from "@/lib/badgeColors";
import { ArrowLeft, Clock, ListChecks, ListTodo } from "lucide-react";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();

  const user = await User.findById(id).select("-passwordHash").lean();
  if (!user) notFound();

  const tasks = await Task.find({ assignee: id }).populate("project", "name").sort({ updatedAt: -1 }).lean();

  let totalHours = 0;
  for (const t of tasks) {
    for (const log of t.timeLogs) {
      if (log.user.toString() === id) totalHours += log.hours;
    }
  }

  const openTasks = tasks.filter((t) => t.columnId !== "done");
  const doneTasks = tasks.filter((t) => t.columnId === "done");

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <Link href="/employees" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className={cn("text-lg", avatarColorFor(user.name))}>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} {user.title ? `· ${user.title}` : ""}
          </p>
        </div>
        <Badge className={cn("capitalize ml-auto border-transparent", roleColors[user.role])}>{user.role}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiTile icon={ListTodo} label="Open tasks" value={openTasks.length} accent="blue" />
        <KpiTile icon={ListChecks} label="Completed" value={doneTasks.length} accent="cyan" />
        <KpiTile icon={Clock} label="Hours logged" value={totalHours.toFixed(1)} accent="violet" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned tasks</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {tasks.length === 0 && <p className="text-sm text-muted-foreground py-4">No tasks assigned yet.</p>}
          {tasks.map((t) => (
            <Link
              key={t._id.toString()}
              href={`/tasks/${t._id}`}
              className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded"
            >
              <div>
                <div className="font-medium text-sm">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {(t.project as unknown as { name: string })?.name}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {t.columnId.replace("-", " ")}
              </Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
