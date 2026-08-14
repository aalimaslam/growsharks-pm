import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.SMTP_FROM || "GrowSharks PM <no-reply@growsharks.com>";
  const t = getTransporter();

  if (!t) {
    console.log(
      `\n[mailer] SMTP not configured — email not sent. Would have sent:\n` +
        `  To:      ${to}\n  Subject: ${subject}\n  ---\n${stripHtml(html)}\n`
    );
    return;
  }

  try {
    await t.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${to} (${subject}):`, err);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
