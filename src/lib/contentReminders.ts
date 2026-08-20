import { connectDB } from "@/lib/db";
import { ContentPost, type ContentPostDoc } from "@/models/ContentPost";
import type { HydratedDocument } from "mongoose";
// Referenced by populate("project"/"assignedTo") below — Mongoose needs the
// model registered in this process/bundle before it can resolve the ref.
// This route has no other reason to import them directly, so without this
// it throws MissingSchemaError on a cold start (confirmed on a fresh dev
// server hitting /api/cron/content-reminders first, before anything else
// happened to register these models) — and would fail on every single
// invocation on Vercel, where each API route is its own isolated bundle.
import "@/models/Project";
import "@/models/User";
import { notify } from "@/lib/notify";
import { contentDayBeforeEmail, contentFinalReminderEmail } from "@/lib/emailTemplates";
import { occurrenceInMonth, hasSeriesStarted, isSameUtcMonth, startOfUtcMonth } from "@/lib/contentRecurrence";

const DAY_BEFORE_MS = 24 * 60 * 60 * 1000;
const FINAL_WINDOW_MS = 4 * 60 * 60 * 1000; // fires any time in the last 4h before the post

// The datetime this post is actually due at, for the cycle "now" falls in —
// its own scheduledDate for a one-off post, or this month's occurrence for
// a recurring one. Returns null if a recurring series hasn't started yet as
// of the current month (see hasSeriesStarted).
function currentOccurrence(post: { scheduledDate: Date; isRecurring: boolean }, now: Date): Date | null {
  if (!post.isRecurring) return new Date(post.scheduledDate);
  const anchor = new Date(post.scheduledDate);
  if (!hasSeriesStarted(anchor, now.getUTCFullYear(), now.getUTCMonth())) return null;
  return occurrenceInMonth(anchor, now.getUTCFullYear(), now.getUTCMonth());
}

// A "sent for this cycle" guard: for a one-off post this is just "ever
// sent" (there's only one cycle); for a recurring post it's scoped to the
// occurrence's month, so it naturally re-arms every month with no separate
// "reopen" step.
function alreadySentForCycle(lastSent: Date | null | undefined, occurrence: Date): boolean {
  return !!lastSent && isSameUtcMonth(new Date(lastSent), occurrence);
}

function formatWhen(d: Date): string {
  return (
    d.toLocaleString("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " UTC"
  );
}

async function sendReminder(
  post: HydratedDocument<ContentPostDoc>,
  occurrence: Date,
  kind: "day-before" | "final"
): Promise<void> {
  const assignee = post.assignedTo as unknown as { _id: unknown; name: string; email: string };
  const project = post.project as unknown as { name: string };

  const build = kind === "day-before" ? contentDayBeforeEmail : contentFinalReminderEmail;
  const { subject, html } = build({
    recipientName: assignee.name,
    postTitle: post.title,
    projectName: project?.name || "",
    platform: post.platform,
    postAt: formatWhen(occurrence),
    isRecurring: post.isRecurring,
  });

  await notify({
    userId: String(assignee._id),
    email: assignee.email,
    type: "content-reminder",
    message: kind === "day-before" ? `Is "${post.title}" ready for tomorrow?` : `"${post.title}" goes live soon.`,
    link: "/content",
    subject,
    html,
  });
}

// Sweeps every content post that could plausibly need a reminder right now:
//  - Day-before check: fires once "due in <= 24h", asking if it's ready.
//  - Final reminder: fires once "due in <= 4h", but ONLY if isReady is true
//    — i.e. only after the content team has confirmed it, per the day-before
//    check. Never fires on its own for a post nobody marked ready.
// Both guards are threshold-crossing (not exact-instant), so they're robust
// to whatever cadence this runs on (the in-process scheduler checks every
// 30 min; an external cron can run as often as the host allows).
// Shared by the in-process scheduler (src/instrumentation.ts, only
// meaningful on a persistent server) and the /api/cron/content-reminders
// route (for serverless hosts like Vercel, driven by an external cron).
export async function sendDueContentReminders(): Promise<{
  checked: number;
  readyChecksSent: number;
  finalRemindersSent: number;
}> {
  await connectDB();

  const now = new Date();

  // Anything that could still need a reminder: every recurring series (its
  // status field doesn't track per-occurrence completion, so it stays
  // "scheduled" forever), plus one-off posts not yet resolved.
  const candidates = await ContentPost.find({
    $or: [{ isRecurring: true }, { status: "scheduled" }],
  })
    .populate("project", "name")
    .populate("assignedTo", "name email");

  let checked = 0;
  let readyChecksSent = 0;
  let finalRemindersSent = 0;

  for (const post of candidates) {
    const occurrence = currentOccurrence(post, now);
    if (!occurrence || occurrence.getTime() <= now.getTime()) continue; // not due, or already passed
    checked++;

    // Roll a stale "ready" confirmation over into "not confirmed yet" at the
    // start of a new monthly cycle, so the flag always reflects *this*
    // occurrence rather than one from a previous month.
    if (post.isRecurring && post.isReady && !(post.readyMarkedAt && isSameUtcMonth(new Date(post.readyMarkedAt), occurrence))) {
      post.isReady = false;
      post.readyMarkedAt = null;
      await post.save();
    }

    const msUntil = occurrence.getTime() - now.getTime();
    const cycleFloor = startOfUtcMonth(occurrence);

    if (msUntil <= DAY_BEFORE_MS && !alreadySentForCycle(post.dayBeforeReminderSentAt, occurrence)) {
      const claimed = await ContentPost.findOneAndUpdate(
        { _id: post._id, $or: [{ dayBeforeReminderSentAt: null }, { dayBeforeReminderSentAt: { $lt: cycleFloor } }] },
        { dayBeforeReminderSentAt: now }
      );
      if (claimed) {
        await sendReminder(post, occurrence, "day-before");
        readyChecksSent++;
      }
    }

    if (post.isReady && msUntil <= FINAL_WINDOW_MS && !alreadySentForCycle(post.finalReminderSentAt, occurrence)) {
      const claimed = await ContentPost.findOneAndUpdate(
        { _id: post._id, $or: [{ finalReminderSentAt: null }, { finalReminderSentAt: { $lt: cycleFloor } }] },
        { finalReminderSentAt: now }
      );
      if (claimed) {
        await sendReminder(post, occurrence, "final");
        finalRemindersSent++;
      }
    }
  }

  return { checked, readyChecksSent, finalRemindersSent };
}
