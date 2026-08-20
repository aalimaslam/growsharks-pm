export type Role = "admin" | "employee";

export type Priority = "low" | "medium" | "high";

export type ProjectStatus = "active" | "on-hold" | "completed" | "archived";

export interface UserJSON {
  _id: string;
  name: string;
  email: string;
  role: Role;
  title?: string;
  isActive: boolean;
  isContentTeam: boolean;
  createdAt: string;
}

export interface ColumnJSON {
  id: string;
  name: string;
  order: number;
}

export interface ProjectJSON {
  _id: string;
  name: string;
  description: string;
  client: string;
  status: ProjectStatus;
  deadline: string | null;
  contentEnabled: boolean;
  createdBy: string;
  members: UserJSON[] | string[];
  columns: ColumnJSON[];
  createdAt: string;
}

export interface CommentJSON {
  _id: string;
  author: UserJSON | string;
  text: string;
  createdAt: string;
}

export interface TimeLogJSON {
  _id: string;
  user: UserJSON | string;
  hours: number;
  note: string;
  date: string;
}

export interface TaskJSON {
  _id: string;
  title: string;
  description: string;
  project: string;
  columnId: string;
  order: number;
  assignee: UserJSON | string | null;
  priority: Priority;
  dueDate: string | null;
  estimatedHours: number | null;
  completedAt: string | null;
  createdBy: UserJSON | string;
  comments: CommentJSON[];
  timeLogs: TimeLogJSON[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationJSON {
  _id: string;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export type FinanceType = "income" | "expense";
export type FinanceStatus = "paid" | "pending" | "overdue";
export type RecurrenceInterval = "weekly" | "monthly" | "yearly";

export interface FinanceAttachmentJSON {
  // Omitted from list responses (GET /api/finance) to avoid shipping every
  // attachment's base64 payload on every page load; present on single-entry
  // fetches (GET /api/finance/[id]) and after create/update.
  dataUrl?: string;
  name: string;
  mimeType: string;
}

export interface FinanceEntryJSON {
  _id: string;
  type: FinanceType;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  status: FinanceStatus;
  isRecurring: boolean;
  recurrenceInterval: RecurrenceInterval | null;
  attachment: FinanceAttachmentJSON | null;
  createdBy: UserJSON | string;
  createdAt: string;
  updatedAt: string;
  reimbursable: boolean;
  reimbursed: boolean;
  reimbursedBy: UserJSON | string | null;
  reimbursedAt: string | null;
}

export type ContentPlatform = "instagram" | "facebook" | "x" | "linkedin" | "youtube" | "tiktok" | "other";
export type ContentStatus = "scheduled" | "posted" | "missed";

export interface ContentPostJSON {
  _id: string;
  project: ProjectJSON | string;
  title: string;
  notes: string;
  platform: ContentPlatform;
  scheduledDate: string;
  isRecurring: boolean;
  assignedTo: UserJSON | string;
  status: ContentStatus;
  isReady: boolean;
  readyMarkedAt: string | null;
  createdBy: UserJSON | string;
  dayBeforeReminderSentAt: string | null;
  finalReminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Present when returned from a month-filtered GET /api/content — the date
  // this item actually falls on within the requested month (equal to
  // scheduledDate except for a recurring post viewed in a later month).
  occurrenceDate: string;
  // True when this row is a computed monthly repeat, not the literal anchor
  // document — editing it still edits the whole series (see scheduledDate).
  isVirtualOccurrence: boolean;
}

export interface AuditLogJSON {
  _id: string;
  entityType: "task" | "project" | "finance";
  entityId: string;
  action: "create" | "update" | "delete" | "comment" | "timelog" | "reimburse" | "unreimburse";
  actor: UserJSON | string;
  message: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}
