import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ContentPost } from "@/models/ContentPost";
import { requireContentAccess, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { updateContentPostSchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { CONTENT_LIST_PREFIX, contentOneKey } from "@/lib/cacheKeys";
import { CONTENT_POPULATE } from "@/lib/contentPopulate";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireContentAccess();
    const { id } = await params;
    await connectDB();

    const post = await withCache(contentOneKey(id), 60, () =>
      ContentPost.findById(id).populate(CONTENT_POPULATE).lean()
    );
    if (!post) throw new ApiError(404, "Content post not found");
    return NextResponse.json({ ...post, occurrenceDate: post.scheduledDate, isVirtualOccurrence: false });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireContentAccess();
    const { id } = await params;
    const body = await parseBody(req, updateContentPostSchema);
    await connectDB();

    // Rescheduling to a new date/time (or reopening a missed/posted post
    // back to "scheduled") should re-arm both reminders so they fire again
    // against the new date.
    const update: Record<string, unknown> = { ...body };
    if (body.scheduledDate || body.status === "scheduled") {
      update.dayBeforeReminderSentAt = null;
      update.finalReminderSentAt = null;
    }
    // readyMarkedAt is server-set, not client-supplied — mirror it whenever
    // isReady changes so contentReminders.ts can tell which cycle it's for.
    if (body.isReady === true) {
      update.readyMarkedAt = new Date();
    } else if (body.isReady === false) {
      update.readyMarkedAt = null;
    }

    const post = await ContentPost.findByIdAndUpdate(id, update, { returnDocument: "after" }).populate(CONTENT_POPULATE);
    if (!post) throw new ApiError(404, "Content post not found");
    await Promise.all([cacheDel(CONTENT_LIST_PREFIX), cacheDel(contentOneKey(id))]);
    const json = post.toJSON();
    return NextResponse.json({ ...json, occurrenceDate: json.scheduledDate, isVirtualOccurrence: false });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireContentAccess();
    const { id } = await params;
    await connectDB();

    const post = await ContentPost.findByIdAndDelete(id);
    if (!post) throw new ApiError(404, "Content post not found");
    await Promise.all([cacheDel(CONTENT_LIST_PREFIX), cacheDel(contentOneKey(id))]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
