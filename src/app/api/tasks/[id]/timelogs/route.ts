import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { timeLogSchema } from "@/lib/validators";
import { canAccessProject } from "@/lib/permissions";
import { cacheDel } from "@/lib/cache";
import { TASKS_LIST_PREFIX, taskOneKey } from "@/lib/cacheKeys";
import { recordAudit } from "@/lib/audit";

const POPULATE = [
  { path: "assignee", select: "name email role title" },
  { path: "createdBy", select: "name email role title" },
  { path: "comments.author", select: "name email role title" },
  { path: "timeLogs.user", select: "name email role title" },
];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    const body = await parseBody(req, timeLogSchema);
    await connectDB();

    const task = await Task.findById(id);
    if (!task) throw new ApiError(404, "Task not found");
    const project = await Project.findById(task.project);
    if (!project) throw new ApiError(404, "Project not found");
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    task.timeLogs.push({
      user: me.id,
      hours: body.hours,
      note: body.note,
      date: body.date ? new Date(body.date) : new Date(),
    } as never);
    await task.save();

    await task.populate(POPULATE);
    await Promise.all([cacheDel(TASKS_LIST_PREFIX), cacheDel(taskOneKey(id))]);
    await recordAudit({
      entityType: "task",
      entityId: id,
      action: "timelog",
      actorId: me.id,
      message: `${me.name} logged ${body.hours}h on "${task.title}"`,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
