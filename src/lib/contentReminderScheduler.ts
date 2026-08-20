import { sendDueContentReminders } from "@/lib/contentReminders";

declare global {
  var __contentReminderInterval: NodeJS.Timeout | undefined;
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Only useful on a persistent Node process (`next start` on a VM/container,
// PM2, Docker, etc). On serverless hosts (Vercel and similar) the runtime
// freezes between requests, so a setInterval scheduled here will rarely if
// ever fire — those deployments must use GET /api/cron/content-reminders on
// an external schedule instead (see vercel.json, which wires this up for
// Vercel specifically via its Cron Jobs feature).
// Guarded on globalThis the same way src/lib/db.ts caches its connection, so
// dev's hot-reload doesn't stack up duplicate intervals.
export function startContentReminderScheduler(): void {
  if (process.env.VERCEL) return;
  if (global.__contentReminderInterval) return;

  const run = () => {
    sendDueContentReminders().catch((err) => {
      console.error("[contentReminderScheduler] failed:", err);
    });
  };

  run();
  global.__contentReminderInterval = setInterval(run, CHECK_INTERVAL_MS);
}
