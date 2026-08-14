import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError } from "@/lib/apiUtils";
import { cacheDel } from "@/lib/cache";
import { USERS_LIST_KEY, PROJECTS_LIST_PREFIX, TASKS_LIST_PREFIX } from "@/lib/cacheKeys";

const selfUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  title: z.string().trim().optional(),
});

export async function PATCH(req: Request) {
  try {
    const me = await requireUser();
    const body = await parseBody(req, selfUpdateSchema);
    await connectDB();
    const user = await User.findByIdAndUpdate(me.id, body, { returnDocument: "after" }).select("-passwordHash");
    await Promise.all([cacheDel(USERS_LIST_KEY), cacheDel(PROJECTS_LIST_PREFIX), cacheDel(TASKS_LIST_PREFIX)]);
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}
