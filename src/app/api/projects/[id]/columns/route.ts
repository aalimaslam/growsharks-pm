import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { requireAdmin, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { columnsSchema } from "@/lib/validators";
import { cacheDel } from "@/lib/cache";
import { PROJECTS_LIST_PREFIX, projectOneKey } from "@/lib/cacheKeys";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, columnsSchema);
    await connectDB();

    const project = await Project.findByIdAndUpdate(id, { columns: body.columns }, { returnDocument: "after" }).populate(
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
