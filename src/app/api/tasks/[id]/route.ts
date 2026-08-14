import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project, DONE_COLUMN_IDS } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateTaskSchema } from "@/lib/validators";
import { canAccessProject, canMoveTask } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { taskAssignedEmail, taskCompletedEmail } from "@/lib/emailTemplates";
import { withCache, cacheDel } from "@/lib/cache";
import { TASKS_LIST_PREFIX, taskOneKey } from "@/lib/cacheKeys";
import { recordAudit, diffFields } from "@/lib/audit";

const POPULATE = [
  { path: "assignee", select: "name email role title" },
  { path: "createdBy", select: "name email role title" },
  { path: "comments.author", select: "name email role title" },
  { path: "timeLogs.user", select: "name email role title" },
];

async function loadTaskAndProject(id: string) {
  const task = await Task.findById(id);
  if (!task) throw new ApiError(404, "Task not found");
  const project = await Project.findById(task.project);
  if (!project) throw new ApiError(404, "Project not found");
  return { task, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const { project } = await loadTaskAndProject(id);
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    const task = await withCache(taskOneKey(id), 20, () => Task.findById(id).populate(POPULATE).lean());
    return NextResponse.json(task);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    const body = await parseBody(req, updateTaskSchema);
    await connectDB();

    const { task, project } = await loadTaskAndProject(id);
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    const isReassigning = body.assignee !== undefined && body.assignee !== (task.assignee?.toString() ?? null);
    if (isReassigning && me.role !== "admin") {
      throw new ApiError(403, "Only admins can reassign tasks");
    }

    const isMoving = body.columnId !== undefined || body.order !== undefined;
    if (isMoving && !canMoveTask(me, task)) {
      throw new ApiError(403, "You can only move tasks assigned to you");
    }
    if (body.columnId && !project.columns.some((c) => c.id === body.columnId)) {
      throw new ApiError(400, "Invalid column for this project");
    }

    const previousColumnId = task.columnId;
    const before = {
      title: task.title,
      description: task.description,
      columnId: task.columnId,
      priority: task.priority,
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
      assignee: task.assignee?.toString() ?? null,
    };

    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.columnId !== undefined) task.columnId = body.columnId;
    if (body.order !== undefined) task.order = body.order;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.dueDate !== undefined) task.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.estimatedHours !== undefined) task.estimatedHours = body.estimatedHours;
    if (body.assignee !== undefined) task.assignee = (body.assignee || null) as typeof task.assignee;

    if (body.columnId !== undefined && body.columnId !== previousColumnId) {
      if (DONE_COLUMN_IDS.has(body.columnId)) task.completedAt = new Date();
      else if (DONE_COLUMN_IDS.has(previousColumnId)) task.completedAt = null;
    }

    await task.save();

    if (isReassigning && task.assignee) {
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

    const movedToDone =
      body.columnId !== undefined && body.columnId !== previousColumnId && DONE_COLUMN_IDS.has(body.columnId);
    if (movedToDone) {
      const recipient = await User.findById(task.createdBy);
      if (recipient && recipient._id.toString() !== me.id) {
        const { subject, html } = taskCompletedEmail({
          recipientName: recipient.name,
          taskTitle: task.title,
          projectName: project.name,
          completedBy: me.name,
          taskId: task._id.toString(),
        });
        await notify({
          userId: recipient._id.toString(),
          email: recipient.email,
          type: "task-completed",
          message: `"${task.title}" in ${project.name} was marked done by ${me.name}.`,
          link: `/tasks/${task._id}`,
          subject,
          html,
        });
      }
    }

    const after = {
      title: task.title,
      description: task.description,
      columnId: task.columnId,
      priority: task.priority,
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
      assignee: task.assignee?.toString() ?? null,
    };
    const changes = diffFields(before, after, Object.keys(after) as (keyof typeof after)[]);

    await task.populate(POPULATE);
    await Promise.all([cacheDel(TASKS_LIST_PREFIX), cacheDel(taskOneKey(id))]);
    if (Object.keys(changes).length > 0) {
      await recordAudit({
        entityType: "task",
        entityId: id,
        action: "update",
        actorId: me.id,
        message: `${me.name} updated task "${task.title}"`,
        changes,
      });
    }
    return NextResponse.json(task);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const { task, project } = await loadTaskAndProject(id);
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");
    if (me.role !== "admin" && task.createdBy.toString() !== me.id) {
      throw new ApiError(403, "Only admins or the task creator can delete this task");
    }

    await Task.findByIdAndDelete(id);
    await Promise.all([cacheDel(TASKS_LIST_PREFIX), cacheDel(taskOneKey(id))]);
    await recordAudit({
      entityType: "task",
      entityId: id,
      action: "delete",
      actorId: me.id,
      message: `${me.name} deleted task "${task.title}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
