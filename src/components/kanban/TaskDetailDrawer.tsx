"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Send, Clock } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { TaskJSON, UserJSON, ColumnJSON, Priority } from "@/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { avatarColorFor } from "@/lib/badgeColors";
import { AuditTrail } from "@/components/AuditTrail";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function personId(p: UserJSON | string | null | undefined): string | null {
  if (!p) return null;
  return typeof p === "string" ? p : p._id;
}

function personName(p: UserJSON | string | null | undefined, members: UserJSON[]): string {
  if (!p) return "Unassigned";
  if (typeof p === "string") return members.find((m) => m._id === p)?.name || "Unknown";
  return p.name;
}

interface TaskDetailDrawerProps {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
  columns: ColumnJSON[];
  members: UserJSON[];
  currentUserId: string;
  isAdmin: boolean;
  onUpdated: (task: TaskJSON) => void;
  onDeleted: (taskId: string) => void;
}

export function TaskDetailDrawer({
  taskId,
  onOpenChange,
  columns,
  members,
  currentUserId,
  isAdmin,
  onUpdated,
  onDeleted,
}: TaskDetailDrawerProps) {
  const [task, setTask] = useState<TaskJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [logHours, setLogHours] = useState("");
  const [logNote, setLogNote] = useState("");
  const [postingLog, setPostingLog] = useState(false);
  const [auditVersion, setAuditVersion] = useState(0);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const t = await apiFetch<TaskJSON>(`/api/tasks/${id}`);
      setTask(t);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load task");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taskId) load(taskId);
    else setTask(null);
  }, [taskId, load]);

  const assigneeId = personId(task?.assignee);
  const creatorId = personId(task?.createdBy);
  const canMove = isAdmin || assigneeId === currentUserId || creatorId === currentUserId;

  const patch = async (body: Record<string, unknown>) => {
    if (!task) return;
    try {
      const updated = await apiFetch<TaskJSON>(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setTask(updated);
      onUpdated(updated);
      setAuditVersion((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to update task");
    }
  };

  const submitComment = async () => {
    if (!task || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const updated = await apiFetch<TaskJSON>(`/api/tasks/${task._id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: commentText.trim() }),
      });
      setTask(updated);
      onUpdated(updated);
      setAuditVersion((v) => v + 1);
      setCommentText("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add comment");
    } finally {
      setPostingComment(false);
    }
  };

  const submitTimeLog = async () => {
    if (!task) return;
    const hours = Number(logHours);
    if (!hours || hours <= 0) {
      toast.error("Enter a valid number of hours");
      return;
    }
    setPostingLog(true);
    try {
      const updated = await apiFetch<TaskJSON>(`/api/tasks/${task._id}/timelogs`, {
        method: "POST",
        body: JSON.stringify({ hours, note: logNote }),
      });
      setTask(updated);
      onUpdated(updated);
      setAuditVersion((v) => v + 1);
      setLogHours("");
      setLogNote("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to log time");
    } finally {
      setPostingLog(false);
    }
  };

  const deleteTask = async () => {
    if (!task) return;
    if (!confirm(`Delete task "${task.title}"? This can't be undone.`)) return;
    try {
      await apiFetch(`/api/tasks/${task._id}`, { method: "DELETE" });
      toast.success("Task deleted");
      onDeleted(task._id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete task");
    }
  };

  const canDelete = task && (isAdmin || creatorId === currentUserId);
  const totalHours = task?.timeLogs.reduce((s, l) => s + l.hours, 0) ?? 0;

  return (
    <Sheet open={!!taskId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-3">
          <SheetTitle className="sr-only">Task details</SheetTitle>
          {!loading && task && (
            <Input
              defaultValue={task.title}
              className="text-base font-semibold border-none px-0 shadow-none focus-visible:ring-0"
              onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && patch({ title: e.target.value.trim() })}
            />
          )}
        </SheetHeader>

        {loading && <div className="p-4 text-sm text-muted-foreground">Loading...</div>}

        {!loading && task && (
          <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <Select
                  value={assigneeId || "unassigned"}
                  onValueChange={(v) => patch({ assignee: v === "unassigned" ? null : v })}
                  disabled={!isAdmin}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{personName(task.assignee, members)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m._id} value={m._id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={task.priority} onValueChange={(v) => patch({ priority: v as Priority })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Column</Label>
                <Select value={task.columnId} onValueChange={(v) => patch({ columnId: v })} disabled={!canMove}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Due date</Label>
                <Input
                  type="date"
                  defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                  onChange={(e) => patch({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Est. hours</Label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="e.g. 8"
                  defaultValue={task.estimatedHours ?? ""}
                  onBlur={(e) =>
                    patch({ estimatedHours: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                rows={4}
                defaultValue={task.description}
                onBlur={(e) => e.target.value !== task.description && patch({ description: e.target.value })}
                placeholder="Add a description..."
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" /> Time logged: {totalHours}h
              </Label>
              <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                {task.timeLogs.map((log) => (
                  <div key={log._id} className="flex items-center justify-between text-sm">
                    <span>
                      {personName(log.user, members)} logged <strong>{log.hours}h</strong>
                      {log.note && <span className="text-muted-foreground"> — {log.note}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(log.date), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  placeholder="Hours"
                  className="w-24"
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                />
                <Input
                  placeholder="Note (optional)"
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTimeLog()}
                />
                <Button size="sm" onClick={submitTimeLog} disabled={postingLog}>
                  Log
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Comments</Label>
              <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                {task.comments.length === 0 && (
                  <p className="text-xs text-muted-foreground">No comments yet.</p>
                )}
                {task.comments.map((c) => {
                  const author = c.author as UserJSON | null | undefined;
                  const authorName = !author || typeof author === "string" ? "Unknown" : author.name;
                  return (
                    <div key={c._id} className="flex items-start gap-2">
                      <Avatar className="size-6 mt-0.5">
                        <AvatarFallback className={cn("text-[10px]", avatarColorFor(authorName))}>
                          {initials(authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium">
                            {!author || typeof author === "string" ? "Unknown" : author.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90">{c.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-start">
                <Textarea
                  rows={2}
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <Button size="icon" onClick={submitComment} disabled={postingComment || !commentText.trim()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Activity</Label>
              <AuditTrail entityType="task" entityId={task._id} refreshKey={auditVersion} />
            </div>

            {canDelete && (
              <>
                <Separator />
                <Button variant="destructive" size="sm" onClick={deleteTask} className="w-fit">
                  <Trash2 /> Delete task
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
