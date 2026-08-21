import { AuditLog } from "@/models/AuditLog";

type EntityType = "task" | "project" | "finance" | "invoice";
type Action = "create" | "update" | "delete" | "comment" | "timelog" | "reimburse" | "unreimburse";

interface RecordAuditOptions {
  entityType: EntityType;
  entityId: string;
  action: Action;
  actorId: string;
  message: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

// Audit trail is observability, not business logic — a write failure here
// must never break the mutation it's describing, so it's caught and logged
// rather than thrown (same philosophy as sendMail in src/lib/mailer.ts).
export async function recordAudit(opts: RecordAuditOptions): Promise<void> {
  try {
    await AuditLog.create({
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: opts.action,
      actor: opts.actorId,
      message: opts.message,
      changes: opts.changes ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to record entry:", err);
  }
}

// Compares `before`/`after` on the given field names and returns only the
// fields that actually changed, shaped for AuditLog.changes.
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = before[field];
    const to = after[field];
    const fromCmp = from instanceof Date ? from.toISOString() : from;
    const toCmp = to instanceof Date ? to.toISOString() : to;
    if (fromCmp === toCmp) continue;
    if (JSON.stringify(fromCmp) === JSON.stringify(toCmp)) continue;
    changes[field as string] = { from: fromCmp, to: toCmp };
  }
  return changes;
}
