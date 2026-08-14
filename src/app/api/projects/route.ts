import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { requireUser, requireAdmin, parseBody, handleApiError } from "@/lib/apiUtils";
import { createProjectSchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { PROJECTS_LIST_PREFIX } from "@/lib/cacheKeys";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  try {
    const me = await requireUser();
    await connectDB();

    const scope = me.role === "admin" ? "admin" : me.id;
    const projects = await withCache(`${PROJECTS_LIST_PREFIX}${scope}`, 60, async () => {
      const filter = me.role === "admin" ? {} : { members: me.id };
      return Project.find(filter).populate("members", "name email role").sort({ createdAt: -1 }).lean();
    });

    return NextResponse.json(projects);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdmin();
    const body = await parseBody(req, createProjectSchema);
    await connectDB();

    const project = await Project.create({
      name: body.name,
      description: body.description,
      client: body.client,
      deadline: body.deadline || null,
      createdBy: me.id,
      members: body.members,
    });

    const populated = await project.populate("members", "name email role");
    await cacheDel(PROJECTS_LIST_PREFIX);
    await recordAudit({
      entityType: "project",
      entityId: project._id.toString(),
      action: "create",
      actorId: me.id,
      message: `${me.name} created project "${project.name}"`,
    });
    return NextResponse.json(populated, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
