// Shared cache-key prefixes, kept out of route.ts files since Next.js route
// modules may only export recognized route handlers/config.
export const PROJECTS_LIST_PREFIX = "projects:list:";
export const TASKS_LIST_PREFIX = "tasks:list:";
export const FINANCE_LIST_PREFIX = "finance:list:";
export const CONTENT_LIST_PREFIX = "content:list:";
export const INVOICE_LIST_PREFIX = "invoices:list:";

export const projectOneKey = (id: string) => `projects:one:${id}`;
export const taskOneKey = (id: string) => `tasks:one:${id}`;
export const financeOneKey = (id: string) => `finance:one:${id}`;
export const contentOneKey = (id: string) => `content:one:${id}`;
export const invoiceOneKey = (id: string) => `invoices:one:${id}`;
export const notificationsListKey = (userId: string) => `notifications:list:${userId}`;
export const USERS_LIST_KEY = "users:list";
