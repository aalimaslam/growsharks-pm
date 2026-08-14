import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const commentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const timeLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    hours: { type: Number, required: true, min: 0.1 },
    note: { type: String, trim: true, default: "" },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    columnId: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    dueDate: { type: Date, default: null },
    estimatedHours: { type: Number, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    comments: { type: [commentSchema], default: [] },
    timeLogs: { type: [timeLogSchema], default: [] },
  },
  { timestamps: true }
);

export type TaskDoc = InferSchemaType<typeof taskSchema>;

export const Task: Model<TaskDoc> = models.Task || model<TaskDoc>("Task", taskSchema);
