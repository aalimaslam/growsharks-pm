import { NextResponse } from "next/server";
import { sendDueContentReminders } from "@/lib/contentReminders";

// Manual/external trigger for the same reminder sweep the in-process
// scheduler runs automatically (see src/instrumentation.ts). Useful for
// testing, or as a backup if you'd rather point an external cron (system
// cron, Windows Task Scheduler, Vercel Cron) at this instead of relying on
// the long-running process. Guarded by CRON_SECRET so it isn't public.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sendDueContentReminders();
  return NextResponse.json(result);
}
