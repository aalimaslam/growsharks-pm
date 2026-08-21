import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const auditLogSchema = new Schema(
  {
    entityType: { type: String, enum: ["task", "project", "finance", "invoice"], required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: {
      type: String,
      enum: ["create", "update", "delete", "comment", "timelog", "reimburse", "unreimburse"],
      required: true,
    },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    // Field-level before/after, e.g. { status: { from: "pending", to: "paid" } }.
    // Kept loose (Mixed) since the shape differs per entity type/action.
    changes: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> = models.AuditLog || model<AuditLogDoc>("AuditLog", auditLogSchema);
