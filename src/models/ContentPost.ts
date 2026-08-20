import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const CONTENT_PLATFORMS = [
  "instagram",
  "facebook",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "other",
] as const;

const contentPostSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: "" },
    platform: { type: String, enum: CONTENT_PLATFORMS, default: "other" },
    // The anchor date+time — for a recurring post this is its first
    // occurrence; later months repeat on this same day-of-month and
    // time-of-day (see contentRecurrence.ts).
    scheduledDate: { type: Date, required: true, index: true },
    isRecurring: { type: Boolean, default: false },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["scheduled", "posted", "missed"], default: "scheduled" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // The content team's "yes, it's ready to post" confirmation — gates the
    // final reminder below. For a recurring post this is rolled back to
    // false at the start of each new monthly cycle (see contentReminders.ts)
    // so it always reflects readiness for *this* occurrence, not a stale one.
    isReady: { type: Boolean, default: false },
    readyMarkedAt: { type: Date, default: null },
    // Set once each reminder email has gone out, so the scheduler never
    // sends the same one twice (also doubles as an atomic claim across
    // multiple server instances) — see contentReminders.ts.
    dayBeforeReminderSentAt: { type: Date, default: null },
    finalReminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type ContentPostDoc = InferSchemaType<typeof contentPostSchema>;

export const ContentPost: Model<ContentPostDoc> =
  models.ContentPost || model<ContentPostDoc>("ContentPost", contentPostSchema);
