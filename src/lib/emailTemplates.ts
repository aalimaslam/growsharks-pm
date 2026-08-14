const appUrl = () => process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

function layout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #171717;">
    <div style="padding: 24px 0 8px; border-bottom: 2px solid #171717;">
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">GrowSharks</span>
      <span style="color: #737373; font-size: 13px; margin-left: 8px;">Project Management</span>
    </div>
    <div style="padding: 24px 0;">
      <h2 style="font-size: 18px; margin: 0 0 12px;">${title}</h2>
      ${bodyHtml}
    </div>
    <div style="padding: 16px 0; border-top: 1px solid #e5e5e5; color: #a3a3a3; font-size: 12px;">
      GrowSharks Project Management &middot; automated notification, no need to reply.
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:10px 18px;background:#171717;color:#fafafa;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${label}</a>`;
}

export function welcomeEmail(opts: { name: string; email: string; tempPassword: string }): { subject: string; html: string } {
  return {
    subject: "Your GrowSharks PM account is ready",
    html: layout("Welcome to GrowSharks Project Management", `
      <p>Hi ${opts.name},</p>
      <p>An admin has created an account for you on the GrowSharks project management tool.</p>
      <p><strong>Email:</strong> ${opts.email}<br/><strong>Temporary password:</strong> ${opts.tempPassword}</p>
      <p>Please sign in and change your password from your profile page.</p>
      ${button(`${appUrl()}/login`, "Sign in")}
    `),
  };
}

export function taskAssignedEmail(opts: { assigneeName: string; taskTitle: string; projectName: string; taskId: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `You've been assigned: ${opts.taskTitle}`,
    html: layout("New task assigned to you", `
      <p>Hi ${opts.assigneeName},</p>
      <p>You've been assigned the task <strong>${opts.taskTitle}</strong> in project <strong>${opts.projectName}</strong>.</p>
      ${button(`${appUrl()}/tasks/${opts.taskId}`, "View task")}
    `),
  };
}

export function taskCompletedEmail(opts: { recipientName: string; taskTitle: string; projectName: string; completedBy: string; taskId: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `Task completed: ${opts.taskTitle}`,
    html: layout("A task was marked done", `
      <p>Hi ${opts.recipientName},</p>
      <p><strong>${opts.completedBy}</strong> moved <strong>${opts.taskTitle}</strong> in project <strong>${opts.projectName}</strong> to Done.</p>
      ${button(`${appUrl()}/tasks/${opts.taskId}`, "View task")}
    `),
  };
}

export function taskCommentEmail(opts: { recipientName: string; commenterName: string; taskTitle: string; commentText: string; taskId: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `New comment on: ${opts.taskTitle}`,
    html: layout("New comment", `
      <p>Hi ${opts.recipientName},</p>
      <p><strong>${opts.commenterName}</strong> commented on <strong>${opts.taskTitle}</strong>:</p>
      <p style="padding:12px;background:#f5f5f5;border-radius:6px;">${opts.commentText}</p>
      ${button(`${appUrl()}/tasks/${opts.taskId}`, "View task")}
    `),
  };
}

export function expenseReimbursedEmail(opts: {
  recipientName: string;
  category: string;
  amount: string;
  reimbursedByName: string;
}): { subject: string; html: string } {
  return {
    subject: `Expense reimbursed: ${opts.category}`,
    html: layout("Expense reimbursed", `
      <p>Hi ${opts.recipientName},</p>
      <p><strong>${opts.reimbursedByName}</strong> marked your expense <strong>${opts.category}</strong> (${opts.amount}) as reimbursed.</p>
      ${button(`${appUrl()}/expenses`, "View expenses")}
    `),
  };
}

export function passwordChangedEmail(opts: { name: string }): { subject: string; html: string } {
  return {
    subject: "Your password was changed",
    html: layout("Password changed", `
      <p>Hi ${opts.name},</p>
      <p>This is a confirmation that your GrowSharks PM account password was just changed. If this wasn't you, contact an admin immediately.</p>
    `),
  };
}
