import { Notification } from "@/models/Notification";
import { sendMail } from "@/lib/mailer";
import { cacheDel } from "@/lib/cache";
import { notificationsListKey } from "@/lib/cacheKeys";
import { publishNotification } from "@/lib/notifyBus";

interface NotifyOptions {
  userId: string;
  email: string;
  type:
    | "task-assigned"
    | "task-completed"
    | "task-comment"
    | "account-created"
    | "password-changed"
    | "expense-reimbursed";
  message: string;
  link?: string;
  subject: string;
  html: string;
}

/**
 * Writes an in-app Notification and sends the matching email. Callers should
 * await this from API route handlers (not fire-and-forget) so a trigger is
 * never silently skipped; mail delivery failures are logged, not thrown.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  const notification = await Notification.create({
    user: opts.userId,
    type: opts.type,
    message: opts.message,
    link: opts.link || "",
  });
  await cacheDel(notificationsListKey(opts.userId));
  publishNotification(opts.userId, notification.toJSON());

  await sendMail(opts.email, opts.subject, opts.html);
}
