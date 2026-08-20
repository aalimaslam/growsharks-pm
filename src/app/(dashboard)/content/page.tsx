"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Repeat, CheckCircle2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { ContentPostJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContentPostDialog } from "@/components/content/ContentPostDialog";
import { cn } from "@/lib/utils";
import { contentStatusColors } from "@/lib/badgeColors";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface PickerProject {
  _id: string;
  name: string;
}

interface PickerUser {
  _id: string;
  name: string;
}

export default function ContentCalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<ContentPostJSON[]>([]);
  const [projects, setProjects] = useState<PickerProject[]>([]);
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ContentPostJSON | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);

  const monthKey = format(month, "yyyy-MM");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ContentPostJSON[]>(`/api/content?month=${monthKey}`);
      setPosts(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load content calendar");
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<PickerProject[]>("/api/content/projects")
      .then(setProjects)
      .catch(() => {});
    apiFetch<PickerUser[]>("/api/content/team")
      .then(setUsers)
      .catch(() => {});
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ContentPostJSON[]>();
    for (const post of posts) {
      // occurrenceDate is the date this post actually falls on within the
      // loaded month — for a recurring post viewed in a later month, that's
      // the computed repeat date, not its original scheduledDate anchor.
      const key = format(new Date(post.occurrenceDate), "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [posts]);

  const stats = useMemo(() => {
    return {
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      posted: posts.filter((p) => p.status === "posted").length,
      missed: posts.filter((p) => p.status === "missed").length,
    };
  }, [posts]);

  const openNewPost = (date?: Date) => {
    setEditingPost(null);
    setDefaultDate(date);
    setDialogOpen(true);
  };

  const openEditPost = (post: ContentPostJSON) => {
    setEditingPost(post);
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  const projectName = (post: ContentPostJSON) => (typeof post.project === "string" ? "" : post.project.name);
  const assigneeName = (post: ContentPostJSON) => (typeof post.assignedTo === "string" ? "" : post.assignedTo.name);

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-4 p-3 sm:p-4 lg:p-5">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/85">
        <div className="soft-grid flex flex-col justify-between gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Content</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Content calendar</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              What&apos;s going out, when, and who owns it. A reminder goes out a day before to check
              readiness, then a final one a few hours before once confirmed.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-card p-1.5 text-center">
            <div className="px-3 py-1.5">
              <div className="text-base font-semibold tabular-nums">{stats.scheduled}</div>
              <div className="text-xs text-muted-foreground">Scheduled</div>
            </div>
            <div className="px-3 py-1.5">
              <div className="text-base font-semibold tabular-nums">{stats.posted}</div>
              <div className="text-xs text-muted-foreground">Posted</div>
            </div>
            <div className="px-3 py-1.5">
              <div className="text-base font-semibold tabular-nums">{stats.missed}</div>
              <div className="text-xs text-muted-foreground">Missed</div>
            </div>
          </div>
          <Button size="lg" onClick={() => openNewPost()}>
            <Plus /> New post
          </Button>
        </div>
      </div>

      <Card size="sm" className="border-dashed">
        <CardContent className="flex items-center justify-between gap-2 py-2.5">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/85">
        <div className="grid grid-cols-7 border-b border-border/80 bg-muted/40 text-center text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) || [];
            const inMonth = isSameMonth(day, month);
            return (
              <div
                key={key}
                className={cn(
                  "group flex min-h-28 flex-col gap-1 border-b border-r border-border/60 p-1.5 last:border-r-0",
                  !inMonth && "bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(day) ? "bg-primary text-primary-foreground" : !inMonth ? "text-muted-foreground/60" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <button
                    type="button"
                    onClick={() => openNewPost(day)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label="Add post"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {dayPosts.map((post) => (
                    <button
                      key={post._id}
                      type="button"
                      onClick={() => openEditPost(post)}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium",
                        contentStatusColors[post.status]
                      )}
                      title={`${format(new Date(post.occurrenceDate), "h:mm a")} · ${post.title} · ${projectName(post)} · ${assigneeName(post)}${post.isRecurring ? " · repeats monthly" : ""}${post.isReady ? " · ready to post" : ""}`}
                    >
                      {post.isRecurring && <Repeat className="size-2.5 shrink-0" />}
                      {post.isReady && <CheckCircle2 className="size-2.5 shrink-0" />}
                      <span className="shrink-0 tabular-nums opacity-80">{format(new Date(post.occurrenceDate), "h:mmaaa")}</span>
                      <span className="truncate">{post.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!loading && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card/70 px-6 py-10 text-center">
          <CalendarDays className="mx-auto mb-3 size-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing on the calendar this month yet.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["scheduled", "posted", "missed"] as const).map((status) => (
          <Badge key={status} className={cn("border-transparent capitalize", contentStatusColors[status])}>
            {status}
          </Badge>
        ))}
      </div>

      <ContentPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        post={editingPost}
        defaultDate={defaultDate}
        projects={projects}
        contentUsers={users}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  );
}
