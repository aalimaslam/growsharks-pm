import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/permissions";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Not signed in");
  return session.user as SessionUser;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError(403, "Admin access required");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => {
    throw new ApiError(400, "Invalid JSON body");
  });
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new ApiError(400, err.issues.map((i) => i.message).join(", "));
    }
    throw err;
  }
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] Unhandled error:", err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
