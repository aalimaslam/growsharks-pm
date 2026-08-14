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
  dataUrl: string;
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
}
