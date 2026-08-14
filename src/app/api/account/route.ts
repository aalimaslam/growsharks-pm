import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError } from "@/lib/apiUtils";

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
    return NextResponse.json(user);
  } catch (err) {
    return handleApiError(err);
  }
}
