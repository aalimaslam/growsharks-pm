import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email(),
  role: z.enum(["admin", "employee"]).default("employee"),
  title: z.string().trim().optional().default(""),
  isContentTeam: z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  title: z.string().trim().optional(),
  role: z.enum(["admin", "employee"]).optional(),
  isActive: z.boolean().optional(),
  isContentTeam: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().optional().default(""),
  client: z.string().trim().optional().default(""),
  deadline: z.string().datetime().optional().nullable(),
  members: z.array(z.string()).optional().default([]),
  contentEnabled: z.boolean().optional().default(false),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  client: z.string().trim().optional(),
  status: z.enum(["active", "on-hold", "completed", "archived"]).optional(),
  deadline: z.string().datetime().nullable().optional(),
  members: z.array(z.string()).optional(),
  contentEnabled: z.boolean().optional(),
});

export const contentPlatforms = ["instagram", "facebook", "x", "linkedin", "youtube", "tiktok", "other"] as const;

export const createContentPostSchema = z.object({
  project: z.string().min(1, "Project is required"),
  title: z.string().trim().min(1, "Title is required"),
  notes: z.string().trim().optional().default(""),
  platform: z.enum(contentPlatforms).optional().default("other"),
  scheduledDate: z.string().datetime(),
  isRecurring: z.boolean().optional().default(false),
  assignedTo: z.string().min(1, "Assignee is required"),
  status: z.enum(["scheduled", "posted", "missed"]).optional().default("scheduled"),
  isReady: z.boolean().optional().default(false),
});

export const updateContentPostSchema = z.object({
  project: z.string().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  isReady: z.boolean().optional(),
  notes: z.string().trim().optional(),
  platform: z.enum(contentPlatforms).optional(),
  scheduledDate: z.string().datetime().optional(),
  isRecurring: z.boolean().optional(),
  assignedTo: z.string().min(1).optional(),
  status: z.enum(["scheduled", "posted", "missed"]).optional(),
});

export const columnsSchema = z.object({
  columns: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1),
        order: z.number(),
      })
    )
    .min(1),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().default(""),
  project: z.string().min(1),
  columnId: z.string().min(1),
  assignee: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().positive().max(1000).nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  columnId: z.string().min(1).optional(),
  order: z.number().optional(),
  assignee: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().positive().max(1000).nullable().optional(),
});

export const commentSchema = z.object({
  text: z.string().trim().min(1, "Comment cannot be empty"),
});

export const timeLogSchema = z.object({
  hours: z.number().positive().max(24),
  note: z.string().trim().optional().default(""),
  date: z.string().datetime().optional(),
});

const attachmentSchema = z.object({
  dataUrl: z.string().min(1).max(6_000_000, "Attachment is too large (max ~4MB)"),
  name: z.string().min(1),
  mimeType: z.string().min(1),
});

export const createFinanceEntrySchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  currency: z.string().trim().optional().default("INR"),
  category: z.string().trim().min(1, "Category is required"),
  description: z.string().trim().optional().default(""),
  date: z.string().datetime(),
  status: z.enum(["paid", "pending", "overdue"]).default("paid"),
  isRecurring: z.boolean().optional().default(false),
  recurrenceInterval: z.enum(["weekly", "monthly", "yearly"]).nullable().optional(),
  attachment: attachmentSchema.nullable().optional(),
  // Out-of-pocket expense that needs paying back. Employees always get this
  // forced true server-side; admins may opt in for their own expenses.
  reimbursable: z.boolean().optional(),
});

export const updateFinanceEntrySchema = z.object({
  type: z.enum(["income", "expense"]).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().trim().optional(),
  category: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  date: z.string().datetime().optional(),
  status: z.enum(["paid", "pending", "overdue"]).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceInterval: z.enum(["weekly", "monthly", "yearly"]).nullable().optional(),
  attachment: attachmentSchema.nullable().optional(),
});

export const reimburseSchema = z.object({
  reimbursed: z.boolean().optional().default(true),
});

export const invoiceStatuses = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "Item description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price can't be negative"),
});

const invoiceClientInputSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  email: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
});

export const createInvoiceSchema = z.object({
  client: invoiceClientInputSchema,
  project: z.string().min(1).nullable().optional(),
  items: z.array(invoiceItemInputSchema).min(1, "Add at least one line item"),
  currency: z.string().trim().min(1).optional().default("INR"),
  taxRate: z.number().min(0).max(100).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  status: z.enum(invoiceStatuses).optional().default("draft"),
  notes: z.string().trim().optional().default(""),
  terms: z.string().trim().optional(),
});

export const updateInvoiceSchema = z.object({
  client: invoiceClientInputSchema.optional(),
  project: z.string().min(1).nullable().optional(),
  items: z.array(invoiceItemInputSchema).min(1).optional(),
  currency: z.string().trim().min(1).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(invoiceStatuses).optional(),
  notes: z.string().trim().optional(),
  terms: z.string().trim().optional(),
});
