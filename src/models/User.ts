import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "employee"], default: "employee", required: true },
    title: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    // Marks this person as part of the content team — makes them selectable
    // as a content-calendar assignee, grants access to /content, and is who
    // gets the day-of reminder email for posts assigned to them.
    isContentTeam: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> = models.User || model<UserDoc>("User", userSchema);
