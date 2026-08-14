import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { requireUser, handleApiError } from "@/lib/apiUtils";

const LIMIT = 6;

export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ projects: [], tasks: [], people: [] });

    await connectDB();

    const regex = { $regex: q, $options: "i" };

    const projectFilter = me.role === "admin" ? { name: regex } : { name: regex, members: me.id };
    const accessibleProjectIds =
      me.role === "admin" ? null : (await Project.find({ members: me.id }).select("_id")).map((p) => p._id);

    const taskFilter: Record<string, unknown> = { title: regex };
    if (accessibleProjectIds) taskFilter.project = { $in: accessibleProjectIds };

    const [projects, tasks, people] = await Promise.all([
      Project.find(projectFilter).select("name").limit(LIMIT).lean(),
      Task.find(taskFilter).select("title project").populate("project", "name").limit(LIMIT).lean(),
      me.role === "admin"
        ? User.find({ $or: [{ name: regex }, { email: regex }] }).select("name email").limit(LIMIT).lean()
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      projects: projects.map((p) => ({ id: p._id, name: p.name })),
      tasks: tasks.map((t) => ({
        id: t._id,
        title: t.title,
        projectName: (t.project as unknown as { name: string })?.name || "",
      })),
      people: people.map((u) => ({ id: u._id, name: u.name, email: u.email })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
