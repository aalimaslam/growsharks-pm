import { Notification } from "@/models/Notification";
import { sendMail } from "@/lib/mailer";

interface NotifyOptions {
  userId: string;
  email: string;
  type: "task-assigned" | "task-completed" | "task-comment" | "account-created" | "password-changed";
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
  await Notification.create({
    user: opts.userId,
    type: opts.type,
    message: opts.message,
    link: opts.link || "",
  });

  await sendMail(opts.email, opts.subject, opts.html);
}
