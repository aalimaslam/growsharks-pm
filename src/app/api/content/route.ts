import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ContentPost } from "@/models/ContentPost";
import { requireContentAccess, parseBody, handleApiError } from "@/lib/apiUtils";
import { createContentPostSchema } from "@/lib/validators";
import { withCache, cacheDel } from "@/lib/cache";
import { CONTENT_LIST_PREFIX } from "@/lib/cacheKeys";
import { CONTENT_POPULATE } from "@/lib/contentPopulate";
import { isAnchorMonth, occurrenceInMonth } from "@/lib/contentRecurrence";

// Content calendar is shared, not scoped per-user — admins and content team
// members all see the same board (see canAccessContent in permissions.ts).
export async function GET(req: Request) {
  try {
    await requireContentAccess();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // "YYYY-MM", optional range filter

    const cacheKey = `${CONTENT_LIST_PREFIX}${month || "all"}`;
    const posts = await withCache(cacheKey, 60, async () => {
      // No month given: just return raw posts, no recurrence expansion (a
      // recurring post has infinite occurrences, so "all" only makes sense
      // bounded to a specific month — the calendar page always passes one).
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        const all = await ContentPost.find().populate(CONTENT_POPULATE).sort({ scheduledDate: 1 }).lean();
        return all.map((p) => ({ ...p, occurrenceDate: p.scheduledDate, isVirtualOccurrence: false }));
      }

      const [yearStr, monthStr] = month.split("-");
      const year = Number(yearStr);
      const monthIndex0 = Number(monthStr) - 1;
      const start = new Date(Date.UTC(year, monthIndex0, 1));
      const end = new Date(Date.UTC(year, monthIndex0 + 1, 1));

      const [oneTime, recurring] = await Promise.all([
        ContentPost.find({ isRecurring: { $ne: true }, scheduledDate: { $gte: start, $lt: end } })
          .populate(CONTENT_POPULATE)
          .lean(),
        // Any recurring series whose first occurrence is on or before the
        // end of this month has (or will have) an occurrence in this month.
        ContentPost.find({ isRecurring: true, scheduledDate: { $lt: end } })
          .populate(CONTENT_POPULATE)
          .lean(),
      ]);

      const oneTimeRows = oneTime.map((p) => ({ ...p, occurrenceDate: p.scheduledDate, isVirtualOccurrence: false }));
      const recurringRows = recurring.map((p) => {
        const anchor = new Date(p.scheduledDate);
        return {
          ...p,
          occurrenceDate: occurrenceInMonth(anchor, year, monthIndex0),
          isVirtualOccurrence: !isAnchorMonth(anchor, year, monthIndex0),
        };
      });

      return [...oneTimeRows, ...recurringRows].sort(
        (a, b) => new Date(a.occurrenceDate).getTime() - new Date(b.occurrenceDate).getTime()
      );
    });

    return NextResponse.json(posts);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireContentAccess();
    const body = await parseBody(req, createContentPostSchema);
    await connectDB();

    const post = await ContentPost.create({
      project: body.project,
      title: body.title,
      notes: body.notes,
      platform: body.platform,
      scheduledDate: body.scheduledDate,
      isRecurring: body.isRecurring,
      assignedTo: body.assignedTo,
      status: body.status,
      isReady: body.isReady,
      readyMarkedAt: body.isReady ? new Date() : null,
      createdBy: me.id,
    });

    const populated = await post.populate(CONTENT_POPULATE);
    await cacheDel(CONTENT_LIST_PREFIX);
    return NextResponse.json(populated, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
