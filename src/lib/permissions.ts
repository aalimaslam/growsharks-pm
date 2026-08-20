import type { ProjectDoc } from "@/models/Project";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "employee";
  isContentTeam: boolean;
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin";
}

// Content calendar is shared between admins and whoever is flagged as
// content team — everyone else (regular employees) can't see it.
export function canAccessContent(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin" || Boolean(user?.isContentTeam);
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

// Admins see/manage every finance entry; employees only their own.
export function canViewFinanceEntry(user: SessionUser, entry: { createdBy: unknown }): boolean {
  return user.role === "admin" || idOf(entry.createdBy) === user.id;
}

// Editing/deleting your own entry is only allowed before it's been
// reimbursed — once money has changed hands the record is locked for
// non-admins so the audit trail stays trustworthy.
export function canEditFinanceEntry(
  user: SessionUser,
  entry: { createdBy: unknown; reimbursed?: boolean }
): boolean {
  if (user.role === "admin") return true;
  return idOf(entry.createdBy) === user.id && !entry.reimbursed;
}

// Reimbursement itself (marking paid back) can be done by an admin, or by
// the employee themselves for their own reimbursable expense — e.g. they
// were already paid back in cash and are just recording it.
export function canReimburseFinanceEntry(user: SessionUser, entry: { createdBy: unknown }): boolean {
  return user.role === "admin" || idOf(entry.createdBy) === user.id;
}
