"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { ContentPlatform, ContentPostJSON, ContentStatus } from "@/types";

interface PickerProject {
  _id: string;
  name: string;
}

interface PickerUser {
  _id: string;
  name: string;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const PLATFORMS: { value: ContentPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "Other" },
];

interface FormState {
  project: string;
  title: string;
  notes: string;
  platform: ContentPlatform;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM, 24h, local time
  isRecurring: boolean;
  assignedTo: string;
  status: ContentStatus;
  isReady: boolean;
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Local wall-clock time (not UTC) — matches what a native time input shows
// and what the user actually typed, regardless of storage timezone.
function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function emptyForm(defaultDate?: Date): FormState {
  return {
    project: "",
    title: "",
    notes: "",
    platform: "instagram",
    scheduledDate: toDateInputValue(defaultDate || new Date()),
    scheduledTime: "12:00",
    isRecurring: false,
    assignedTo: "",
    status: "scheduled",
    isReady: false,
  };
}

interface ContentPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: ContentPostJSON | null;
  defaultDate?: Date;
  projects: PickerProject[];
  contentUsers: PickerUser[];
  onSaved: () => void;
  onDeleted: () => void;
}

export function ContentPostDialog({
  open,
  onOpenChange,
  post,
  defaultDate,
  projects,
  contentUsers,
  onSaved,
  onDeleted,
}: ContentPostDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (post) {
      const project = typeof post.project === "string" ? post.project : post.project._id;
      const assignedTo = typeof post.assignedTo === "string" ? post.assignedTo : post.assignedTo._id;
      setForm({
        project,
        title: post.title,
        notes: post.notes,
        platform: post.platform,
        // Always the series anchor date, even when opened from a computed
        // occurrence in a later month — editing a recurring post edits the
        // whole series, not just the month it was clicked from.
        scheduledDate: toDateInputValue(new Date(post.scheduledDate)),
        scheduledTime: toTimeInputValue(new Date(post.scheduledDate)),
        isRecurring: post.isRecurring,
        assignedTo,
        status: post.status,
        isReady: post.isReady,
      });
    } else {
      setForm(emptyForm(defaultDate));
    }
  }, [open, post, defaultDate]);

  const submit = async () => {
    if (!form.project) {
      toast.error("Choose a project");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.assignedTo) {
      toast.error("Assign this post to someone from the content team");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        project: form.project,
        title: form.title.trim(),
        notes: form.notes.trim(),
        platform: form.platform,
        scheduledDate: new Date(`${form.scheduledDate}T${form.scheduledTime}`).toISOString(),
        isRecurring: form.isRecurring,
        assignedTo: form.assignedTo,
        // Recurring posts don't track a single occurrence's completion —
        // keep them "scheduled" so every month's reminder still fires.
        status: form.isRecurring ? "scheduled" : form.status,
        isReady: form.isReady,
      };

      if (post) {
        await apiFetch(`/api/content/${post._id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Post updated");
      } else {
        await apiFetch("/api/content", { method: "POST", body: JSON.stringify(body) });
        toast.success("Post added to the calendar");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save post");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!post) return;
    const warning = post.isRecurring
      ? `Delete "${post.title}"? This stops the monthly recurrence entirely — every future occurrence goes with it. This cannot be undone.`
      : `Delete "${post.title}"? This cannot be undone.`;
    if (!confirm(warning)) return;
    try {
      await apiFetch(`/api/content/${post._id}`, { method: "DELETE" });
      toast.success("Post deleted");
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete post");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>{post ? "Edit content post" : "New content post"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Project</Label>
            <Select value={form.project} onValueChange={(v) => setForm((f) => ({ ...f, project: v as string }))}>
              <SelectTrigger className="h-8 text-sm rounded-md">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No projects marked for content yet.
                  </div>
                )}
                {projects.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-title" className="text-xs font-medium">Title</Label>
            <Input
              id="content-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Product launch reel"
              className="h-8 text-sm rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-date" className="text-xs font-medium">
                {form.isRecurring ? "First post date" : "Post date"}
              </Label>
              <Input
                id="content-date"
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-time" className="text-xs font-medium">Post time</Label>
              <Input
                id="content-time"
                type="time"
                value={form.scheduledTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                className="h-8 text-sm rounded-md"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Platform</Label>
            <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v as ContentPlatform }))}>
              <SelectTrigger className="h-8 text-sm rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.isRecurring}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isRecurring: checked === true }))}
              />
              Repeats monthly on this date
            </label>
            <p className="pl-6 text-xs text-muted-foreground">
              {form.isRecurring
                ? "Happens every month on this day (shifted to the month's last day if it's shorter, e.g. the 31st becomes the 28th/29th in February). A reminder goes out each time."
                : "Leave unchecked for a one-off post that only happens this month."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Assigned to</Label>
            <Select value={form.assignedTo} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v as string }))}>
              <SelectTrigger className="h-8 text-sm rounded-md">
                <SelectValue placeholder="Pick from the content team" />
              </SelectTrigger>
              <SelectContent>
                {contentUsers.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No one is marked as content team yet — do that from Employees first.
                  </div>
                )}
                {contentUsers.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              They&apos;ll get a reminder about a day before asking if it&apos;s ready
              {form.isRecurring ? ", every month" : ""} — and a final one a few hours
              before, once someone confirms it is.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-notes" className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              id="content-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="text-sm rounded-md"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.isReady}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isReady: checked === true }))}
              />
              Ready to post
            </label>
            <p className="pl-6 text-xs text-muted-foreground">
              {form.isRecurring
                ? "Confirms this month's post is prepared — unlocks the final reminder a few hours before it's due, then resets automatically next month."
                : "Confirms the content is prepared — unlocks the final reminder a few hours before it's due."}
            </p>
          </div>

          {post && !form.isRecurring && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ContentStatus }))}>
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {post && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive mr-auto" onClick={remove}>
              <Trash2 /> Delete
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} size="sm">
            {submitting ? "Saving..." : post ? "Save changes" : "Add post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
