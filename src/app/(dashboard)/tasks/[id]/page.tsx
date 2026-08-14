import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";

export default async function TaskRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDB();

  const task = await Task.findById(id).select("project");
  if (!task) notFound();

  redirect(`/projects/${task.project}?task=${id}`);
}
