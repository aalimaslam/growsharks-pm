import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { requireContentAccess, handleApiError } from "@/lib/apiUtils";

// A narrow list (name only) of content-enabled projects, visible to anyone
// with content access regardless of project membership — /api/projects is
// scoped to "projects you're a member of" for non-admins, which would hide
// content-only projects from content team members who aren't board members.
export async function GET() {
  try {
    await requireContentAccess();
    await connectDB();
    const projects = await Project.find({ contentEnabled: true }).select("name").sort({ name: 1 }).lean();
    return NextResponse.json(projects);
  } catch (err) {
    return handleApiError(err);
  }
}
