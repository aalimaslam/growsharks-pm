import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const DEFAULT_COLUMNS = [
  { id: "backlog", name: "Backlog", order: 0 },
  { id: "todo", name: "To Do", order: 1 },
  { id: "in-progress", name: "In Progress", order: 2 },
  { id: "in-review", name: "In Review", order: 3 },
  { id: "done", name: "Done", order: 4 },
];

// Columns whose name/id look like a "done" state trigger the task-completed email.
export const DONE_COLUMN_IDS = new Set(["done", "completed", "complete"]);

const columnSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    client: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "on-hold", "completed", "archived"], default: "active" },
    deadline: { type: Date },
    // Whether we're producing content (social posts, etc.) for this client —
    // drives whether it shows up as a project option on the content calendar.
    contentEnabled: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    columns: { type: [columnSchema], default: DEFAULT_COLUMNS },
  },
  { timestamps: true }
);

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

export const Project: Model<ProjectDoc> = models.Project || model<ProjectDoc>("Project", projectSchema);
