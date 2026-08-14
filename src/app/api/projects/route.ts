import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { requireUser, requireAdmin, parseBody, handleApiError } from "@/lib/apiUtils";
import { createProjectSchema } from "@/lib/validators";

export async function GET() {
  try {
    const me = await requireUser();
    await connectDB();

    const filter = me.role === "admin" ? {} : { members: me.id };
    const projects = await Project.find(filter)
      .populate("members", "name email role")
      .sort({ createdAt: -1 });

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
    return NextResponse.json(populated, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
