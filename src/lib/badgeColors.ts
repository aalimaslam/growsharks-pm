// Shared color mappings for the accent family defined in globals.css —
// keeps priority/status/role color-coding consistent across the app.

export const priorityColors: Record<string, string> = {
  low: "bg-accent-cyan-soft text-accent-cyan",
  medium: "bg-accent-amber-soft text-accent-amber",
  high: "bg-accent-pink-soft text-accent-pink",
};

export const priorityBorderColors: Record<string, string> = {
  low: "border-l-accent-cyan",
  medium: "border-l-accent-amber",
  high: "border-l-accent-pink",
};

export const projectStatusColors: Record<string, string> = {
  active: "bg-accent-blue-soft text-accent-blue",
  "on-hold": "bg-accent-amber-soft text-accent-amber",
  completed: "bg-accent-violet-soft text-accent-violet",
  archived: "bg-muted text-muted-foreground",
};

export const projectStatusBorderColors: Record<string, string> = {
  active: "border-t-accent-blue",
  "on-hold": "border-t-accent-amber",
  completed: "border-t-accent-violet",
  archived: "border-t-border",
};

export const roleColors: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  employee: "bg-accent-blue-soft text-accent-blue",
};

export const financeStatusColors: Record<string, string> = {
  paid: "bg-accent-cyan-soft text-accent-cyan",
  pending: "bg-accent-amber-soft text-accent-amber",
  overdue: "bg-accent-pink-soft text-accent-pink",
};

export const reimbursementColors: Record<"reimbursed" | "pending", string> = {
  reimbursed: "bg-accent-cyan-soft text-accent-cyan",
  pending: "bg-accent-amber-soft text-accent-amber",
};

export const contentStatusColors: Record<string, string> = {
  scheduled: "bg-accent-blue-soft text-accent-blue",
  posted: "bg-accent-cyan-soft text-accent-cyan",
  missed: "bg-accent-pink-soft text-accent-pink",
};

export const contentStatusBorderColors: Record<string, string> = {
  scheduled: "border-l-accent-blue",
  posted: "border-l-accent-cyan",
  missed: "border-l-accent-pink",
};

const avatarPalette = [
  "bg-accent-blue-soft text-accent-blue",
  "bg-accent-violet-soft text-accent-violet",
  "bg-accent-cyan-soft text-accent-cyan",
  "bg-accent-pink-soft text-accent-pink",
  "bg-accent-amber-soft text-accent-amber",
];

/** Deterministic accent color per person, so avatars read as colorful instead of uniform grey. */
export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length];
}
