import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { canAccessProject, type SessionUser } from "@/lib/permissions";
import { Board } from "@/components/kanban/Board";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projectStatusColors } from "@/lib/badgeColors";
import { cn } from "@/lib/utils";
import { Settings, ArrowLeft, CalendarDays, Users, Building2 } from "lucide-react";

const POPULATE = [
  { path: "assignee", select: "name email role title" },
  { path: "createdBy", select: "name email role title" },
  { path: "comments.author", select: "name email role title" },
  { path: "timeLogs.user", select: "name email role title" },
];

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const { task: openTaskId } = await searchParams;
  await connectDB();

  const project = await Project.findById(id).populate("members", "name email role title");
  if (!project) notFound();
  if (!canAccessProject(session.user as SessionUser, project)) notFound();

  const tasks = await Task.find({ project: id }).populate(POPULATE).sort({ order: 1 });
  const memberCount = project.members?.length ?? 0;
  const deadline = project.deadline ? new Date(project.deadline).toLocaleDateString() : null;
  const shortDescription = project.description?.trim() || null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/80 bg-card/85 px-3 py-3 backdrop-blur-xl sm:px-4 lg:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/projects" className="rounded-lg border bg-card p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                <ArrowLeft className="size-4" />
              </Link>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Project board</p>
                <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge className={cn("border-transparent capitalize", projectStatusColors[project.status])}>{project.status}</Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                <Users className="size-3.5" /> {memberCount} member{memberCount !== 1 ? "s" : ""}
              </span>
              {project.client && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                  <Building2 className="size-3.5" /> {project.client}
                </span>
              )}
              {deadline && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                  <CalendarDays className="size-3.5" /> Due {deadline}
                </span>
              )}
            </div>
            {shortDescription && <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{shortDescription}</p>}
          </div>
          {session.user.role === "admin" && (
            <Link href={`/projects/${id}/settings`}>
              <Button variant="outline" size="sm">
                <Settings /> Settings
              </Button>
            </Link>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Board
          project={JSON.parse(JSON.stringify(project))}
          initialTasks={JSON.parse(JSON.stringify(tasks))}
          currentUserId={session.user.id}
          isAdmin={session.user.role === "admin"}
          initialOpenTaskId={openTaskId ?? null}
        />
      </div>
    </div>
  );
}
