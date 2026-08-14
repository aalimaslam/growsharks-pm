import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { requireUser, parseBody, handleApiError } from "@/lib/apiUtils";
import { withCache, cacheDel } from "@/lib/cache";
import { notificationsListKey } from "@/lib/cacheKeys";

export async function GET() {
  try {
    const me = await requireUser();
    await connectDB();
    const notifications = await withCache(notificationsListKey(me.id), 15, () =>
      Notification.find({ user: me.id }).sort({ createdAt: -1 }).limit(50).lean()
    );
    return NextResponse.json(notifications);
  } catch (err) {
    return handleApiError(err);
  }
}

const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const body = await parseBody(req, markReadSchema);
    await connectDB();

    if (body.all) {
      await Notification.updateMany({ user: me.id, read: false }, { read: true });
    } else if (body.ids?.length) {
      await Notification.updateMany({ _id: { $in: body.ids }, user: me.id }, { read: true });
    }

    await cacheDel(notificationsListKey(me.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
