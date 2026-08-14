import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { FinanceEntry } from "@/models/FinanceEntry";
import { User } from "@/models/User";
import { requireUser, parseBody, handleApiError, ApiError } from "@/lib/apiUtils";
import { reimburseSchema } from "@/lib/validators";
import { canReimburseFinanceEntry } from "@/lib/permissions";
import { cacheDel } from "@/lib/cache";
import { FINANCE_LIST_PREFIX, financeOneKey } from "@/lib/cacheKeys";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { expenseReimbursedEmail } from "@/lib/emailTemplates";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser();
    const { id } = await params;
    const body = await parseBody(req, reimburseSchema);
    await connectDB();

    const entry = await FinanceEntry.findById(id);
    if (!entry) throw new ApiError(404, "Entry not found");
    if (!entry.reimbursable) throw new ApiError(400, "This entry isn't marked as reimbursable");
    if (!canReimburseFinanceEntry(me, entry)) throw new ApiError(403, "Forbidden");

    entry.reimbursed = body.reimbursed;
    entry.reimbursedBy = (body.reimbursed ? me.id : null) as typeof entry.reimbursedBy;
    entry.reimbursedAt = body.reimbursed ? new Date() : null;
    await entry.save();

    await Promise.all([cacheDel(FINANCE_LIST_PREFIX), cacheDel(financeOneKey(id))]);
    await recordAudit({
      entityType: "finance",
      entityId: id,
      action: body.reimbursed ? "reimburse" : "unreimburse",
      actorId: me.id,
      message: body.reimbursed
        ? `${me.name} marked "${entry.category}" as reimbursed`
        : `${me.name} reverted the reimbursement on "${entry.category}"`,
    });

    if (body.reimbursed && entry.createdBy.toString() !== me.id) {
      const recipient = await User.findById(entry.createdBy);
      if (recipient) {
        const amountLabel = `${entry.currency} ${entry.amount}`;
        const { subject, html } = expenseReimbursedEmail({
          recipientName: recipient.name,
          category: entry.category,
          amount: amountLabel,
          reimbursedByName: me.name,
        });
        await notify({
          userId: recipient._id.toString(),
          email: recipient.email,
          type: "expense-reimbursed",
          message: `${me.name} reimbursed your "${entry.category}" expense (${amountLabel}).`,
          link: "/expenses",
          subject,
          html,
        });
      }
    }

    await entry.populate([
      { path: "createdBy", select: "name email" },
      { path: "reimbursedBy", select: "name email" },
    ]);
    return NextResponse.json(entry);
  } catch (err) {
    return handleApiError(err);
  }
}
