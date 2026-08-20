export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startContentReminderScheduler } = await import("@/lib/contentReminderScheduler");
    startContentReminderScheduler();
  }
}
