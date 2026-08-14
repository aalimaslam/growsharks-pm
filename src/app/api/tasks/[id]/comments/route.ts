import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { commentSchema } from "@/lib/validators";
import { canAccessProject } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { taskCommentEmail } from "@/lib/emailTemplates";
import { cacheDel } from "@/lib/cache";
import { TASKS_LIST_PREFIX, taskOneKey } from "@/lib/cacheKeys";

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
    const body = await parseBody(req, commentSchema);
    await connectDB();

    const task = await Task.findById(id);
    if (!task) throw new ApiError(404, "Task not found");
    const project = await Project.findById(task.project);
    if (!project) throw new ApiError(404, "Project not found");
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    task.comments.push({ author: me.id, text: body.text } as never);
    await task.save();

    const participantIds = new Set<string>();
    if (task.assignee) participantIds.add(task.assignee.toString());
    participantIds.add(task.createdBy.toString());
    participantIds.delete(me.id);

    for (const uid of participantIds) {
      const recipient = await User.findById(uid);
      if (!recipient) continue;
      const { subject, html } = taskCommentEmail({
        recipientName: recipient.name,
        commenterName: me.name,
        taskTitle: task.title,
        commentText: body.text,
        taskId: task._id.toString(),
      });
      await notify({
        userId: recipient._id.toString(),
        email: recipient.email,
        type: "task-comment",
        message: `${me.name} commented on "${task.title}".`,
        link: `/tasks/${task._id}`,
        subject,
        html,
      });
    }

    await task.populate(POPULATE);
    await Promise.all([cacheDel(TASKS_LIST_PREFIX), cacheDel(taskOneKey(id))]);
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
