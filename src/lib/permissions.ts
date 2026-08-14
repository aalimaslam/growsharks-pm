import type { ProjectDoc } from "@/models/Project";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "employee";
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin";
}

// project.members may be raw ObjectIds/strings or populated User documents
// (e.g. `.populate("members", ...)`), so a plain `.toString()` isn't safe —
// on a populated document it returns "[object Object]", not the id.
function idOf(value: unknown): string {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

export function canAccessProject(
  user: SessionUser,
  project: Pick<ProjectDoc, "members" | "createdBy">
): boolean {
  if (user.role === "admin") return true;
  const memberIds = (project.members as unknown[]).map(idOf);
  return memberIds.includes(user.id) || idOf(project.createdBy) === user.id;
}

export function canMoveTask(
  user: SessionUser,
  task: { assignee?: unknown; createdBy: unknown }
): boolean {
  if (user.role === "admin") return true;
  const assigneeId = task.assignee ? String(task.assignee) : null;
  const creatorId = task.createdBy ? String(task.createdBy) : null;
  return assigneeId === user.id || creatorId === user.id;
}
