import { Schema, model, models, type Model } from "mongoose";

// Generic atomic sequence counter (keyed e.g. "invoice:2026"), so numbering
// stays gap-free/collision-free under concurrent writes without a separate
// model per sequence.
interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<CounterDoc> = models.Counter || model<CounterDoc>("Counter", counterSchema);
