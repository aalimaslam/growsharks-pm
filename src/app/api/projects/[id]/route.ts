import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { requireUser, requireAdmin, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateProjectSchema } from "@/lib/validators";
import { canAccessProject } from "@/lib/permissions";
import { withCache, cacheDel } from "@/lib/cache";
import { PROJECTS_LIST_PREFIX, TASKS_LIST_PREFIX, projectOneKey } from "@/lib/cacheKeys";
import { recordAudit, diffFields } from "@/lib/audit";

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
    const me = await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, updateProjectSchema);
    await connectDB();

    const existing = await Project.findById(id);
    if (!existing) throw new ApiError(404, "Project not found");
    const before = {
      name: existing.name,
      description: existing.description,
      client: existing.client,
      status: existing.status,
      deadline: existing.deadline,
      members: existing.members.map((m) => m.toString()).sort().join(","),
    };

    const project = await Project.findByIdAndUpdate(id, body, { returnDocument: "after" }).populate(
      "members",
      "name email role title"
    );
    if (!project) throw new ApiError(404, "Project not found");
    await Promise.all([cacheDel(PROJECTS_LIST_PREFIX), cacheDel(projectOneKey(id))]);

    const after = {
      name: project.name,
      description: project.description,
      client: project.client,
      status: project.status,
      deadline: project.deadline,
      members: (project.members as unknown as { _id: unknown }[])
        .map((m) => String(m._id))
        .sort()
        .join(","),
    };
    const changes = diffFields(before, after, Object.keys(after) as (keyof typeof after)[]);
    if (Object.keys(changes).length > 0) {
      await recordAudit({
        entityType: "project",
        entityId: id,
        action: "update",
        actorId: me.id,
        message: `${me.name} updated project "${project.name}"`,
        changes,
      });
    }
    return NextResponse.json(project);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireAdmin();
    const { id } = await params;
    await connectDB();

    const project = await Project.findByIdAndDelete(id);
    if (!project) throw new ApiError(404, "Project not found");
    await Task.deleteMany({ project: id });
    await Promise.all([cacheDel(PROJECTS_LIST_PREFIX), cacheDel(projectOneKey(id)), cacheDel(TASKS_LIST_PREFIX)]);
    await recordAudit({
      entityType: "project",
      entityId: id,
      action: "delete",
      actorId: me.id,
      message: `${me.name} deleted project "${project.name}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
