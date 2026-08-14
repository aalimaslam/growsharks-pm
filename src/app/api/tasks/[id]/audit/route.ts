import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { requireUser, handleApiError, ApiError } from "@/lib/apiUtils";
import { canAccessProject } from "@/lib/permissions";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const task = await Task.findById(id);
    if (!task) throw new ApiError(404, "Task not found");
    const project = await Project.findById(task.project);
    if (!project) throw new ApiError(404, "Project not found");
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    const entries = await AuditLog.find({ entityType: "task", entityId: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actor", "name email role")
      .lean();

    return NextResponse.json(entries);
  } catch (err) {
    return handleApiError(err);
  }
}
