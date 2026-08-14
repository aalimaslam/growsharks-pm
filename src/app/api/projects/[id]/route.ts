import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { requireUser, requireAdmin, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateProjectSchema } from "@/lib/validators";
import { canAccessProject } from "@/lib/permissions";
import { withCache, cacheDel } from "@/lib/cache";
import { PROJECTS_LIST_PREFIX, TASKS_LIST_PREFIX, projectOneKey } from "@/lib/cacheKeys";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    await connectDB();

    const project = await withCache(projectOneKey(id), 60, () =>
      Project.findById(id).populate("members", "name email role title").lean()
    );
    if (!project) throw new ApiError(404, "Project not found");
    if (!canAccessProject(me, project)) throw new ApiError(403, "Forbidden");

    return NextResponse.json(project);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, updateProjectSchema);
    await connectDB();

    const project = await Project.findByIdAndUpdate(id, body, { returnDocument: "after" }).populate(
      "members",
      "name email role title"
    );
    if (!project) throw new ApiError(404, "Project not found");
    await Promise.all([cacheDel(PROJECTS_LIST_PREFIX), cacheDel(projectOneKey(id))]);
    return NextResponse.json(project);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await connectDB();

    const project = await Project.findByIdAndDelete(id);
    if (!project) throw new ApiError(404, "Project not found");
    await Task.deleteMany({ project: id });
    await Promise.all([cacheDel(PROJECTS_LIST_PREFIX), cacheDel(projectOneKey(id)), cacheDel(TASKS_LIST_PREFIX)]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
