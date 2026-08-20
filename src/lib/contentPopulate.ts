// Referenced by the populate paths below — Mongoose needs the model
// registered in this process/bundle before it can resolve a ref by string
// name. Neither model is otherwise imported (directly or transitively) by
// every route that uses CONTENT_POPULATE, which throws MissingSchemaError
// without this (confirmed: a fresh process hitting a content route as its
// first request crashed here before this fix).
import "@/models/Project";
import "@/models/User";

export const CONTENT_POPULATE = [
  { path: "project", select: "name contentEnabled" },
  { path: "assignedTo", select: "name email isContentTeam" },
  { path: "createdBy", select: "name email" },
];
