import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { createTaskSchema } from "@/lib/validators";
import { canAccessProject } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { taskAssignedEmail } from "@/lib/emailTemplates";
import { withCache, cacheDel } from "@/lib/cache";
import { TASKS_LIST_PREFIX } from "@/lib/cacheKeys";
import { recordAudit } from "@/lib/audit";

const POPULATE = [
  { path: "assignee", select: "name email role title" },
  { path: "createdBy", select: "name email role title" },
  { path: "comments.author", select: "name email role title" },
  { path: "timeLogs.user", select: "name email role title" },
];

// The board/list view only renders assignee + createdBy; comments and time
// logs are fetched in full detail by GET /api/tasks/[id] when a task opens.
const LIST_POPULATE = [
  { path: "assignee", select: "name email role title" },
  { path: "createdBy", select: "name email role title" },
];

export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project");
    const mine = searchParams.get("mine") === "true";

    await connectDB();

    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) throw new ApiError(404, "Project not found");
      if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");
    }

    const cacheKey = `${TASKS_LIST_PREFIX}${projectId ?? "all"}:${mine ? me.id : "all"}:${me.role === "admin" ? "admin" : me.id}`;
    const tasks = await withCache(cacheKey, 20, async () => {
      const filter: Record<string, unknown> = {};
      if (projectId) {
        filter.project = projectId;
      } else if (me.role !== "admin") {
        // No project filter + not admin: scope to projects the user belongs to.
        const projects = await Project.find({ members: me.id }).select("_id");
        filter.project = { $in: projects.map((p) => p._id) };
      }
      if (mine) filter.assignee = me.id;

      return Task.find(filter).populate(LIST_POPULATE).sort({ order: 1 }).lean();
    });
    return NextResponse.json(tasks);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const body = await parseBody(req, createTaskSchema);
    await connectDB();

    const project = await Project.findById(body.project);
    if (!project) throw new ApiError(404, "Project not found");
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    const columnExists = project.columns.some((c) => c.id === body.columnId);
    if (!columnExists) throw new ApiError(400, "Invalid column for this project");

    if (body.assignee) {
      const isMember = project.members.some((m) => m.toString() === body.assignee);
      if (!isMember && me.role !== "admin") throw new ApiError(400, "Assignee must be a project member");
    }

    const last = await Task.findOne({ project: project._id, columnId: body.columnId }).sort({ order: -1 });
    const order = last ? last.order + 1 : 0;

    const task = await Task.create({
      title: body.title,
      description: body.description,
      project: project._id,
      columnId: body.columnId,
      order,
      assignee: body.assignee || null,
      priority: body.priority,
      dueDate: body.dueDate || null,
      estimatedHours: body.estimatedHours ?? null,
      createdBy: me.id,
    });

    if (task.assignee && task.assignee.toString() !== me.id) {
      const assignee = await User.findById(task.assignee);
      if (assignee) {
        const { subject, html } = taskAssignedEmail({
          assigneeName: assignee.name,
          taskTitle: task.title,
          projectName: project.name,
          taskId: task._id.toString(),
        });
        await notify({
          userId: assignee._id.toString(),
          email: assignee.email,
          type: "task-assigned",
          message: `You were assigned "${task.title}" in ${project.name}.`,
          link: `/tasks/${task._id}`,
          subject,
          html,
        });
      }
    }

    await task.populate(POPULATE);
    await cacheDel(TASKS_LIST_PREFIX);
    await recordAudit({
      entityType: "task",
      entityId: task._id.toString(),
      action: "create",
      actorId: me.id,
      message: `${me.name} created task "${task.title}"`,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
