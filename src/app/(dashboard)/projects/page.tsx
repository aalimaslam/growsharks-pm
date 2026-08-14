"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Users as UsersIcon, Calendar, FolderKanban, Search, X } from "lucide-react";
import { z } from "zod";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { createProjectSchema } from "@/lib/validators";
import type { ProjectJSON, UserJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { projectStatusColors, projectStatusBorderColors } from "@/lib/badgeColors";

type ProjectFormInput = z.input<typeof createProjectSchema>;
type ProjectFormOutput = z.output<typeof createProjectSchema>;

export default function ProjectsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [projects, setProjects] = useState<ProjectJSON[]>([]);
  const [employees, setEmployees] = useState<UserJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectJSON["status"]>("all");
  const [deadlineFilter, setDeadlineFilter] = useState<"all" | "overdue" | "upcoming" | "no-deadline">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ProjectJSON[]>("/api/projects");
      setProjects(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) {
      apiFetch<UserJSON[]>("/api/users")
        .then((u) => setEmployees(u.filter((e) => e.isActive)))
        .catch(() => {});
    }
  }, [isAdmin]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormInput, unknown, ProjectFormOutput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "", client: "", members: [] },
  });

  const selectedMembers = watch("members") || [];
  const activeProjects = projects.filter((p) => p.status === "active").length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = new Date();

    return projects.filter((project) => {
      if (statusFilter !== "all" && project.status !== statusFilter) return false;

      const deadline = project.deadline ? new Date(project.deadline) : null;
      if (deadlineFilter === "overdue" && (!deadline || deadline >= now)) return false;
      if (deadlineFilter === "upcoming" && (!deadline || deadline < now)) return false;
      if (deadlineFilter === "no-deadline" && deadline) return false;

      if (!query) return true;
      const searchable = [project.name, project.client, project.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [projects, searchQuery, statusFilter, deadlineFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== "all" || deadlineFilter !== "all";

  const toggleMember = (id: string) => {
    const next = selectedMembers.includes(id)
      ? selectedMembers.filter((m) => m !== id)
      : [...selectedMembers, id];
    setValue("members", next);
  };

  const onSubmit = async (data: ProjectFormOutput) => {
    try {
      await apiFetch("/api/projects", { method: "POST", body: JSON.stringify(data) });
      toast.success(`Project "${data.name}" created`);
      reset({ name: "", description: "", client: "", members: [] });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create project");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-4 p-3 sm:p-4 lg:p-5">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/85">
        <div className="soft-grid flex flex-col justify-between gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Portfolio</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin ? "All projects" : "Projects you're a member of"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-card p-1.5 text-center">
            <div className="px-3 py-1.5">
              <div className="text-base font-semibold tabular-nums">{projects.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="px-3 py-1.5">
              <div className="text-base font-semibold tabular-nums">{activeProjects}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="px-3 py-1.5">
              <div className="text-base font-semibold tabular-nums">{completedProjects}</div>
              <div className="text-xs text-muted-foreground">Done</div>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button size="lg">
                    <Plus /> New project
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...register("name")} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="client">Client (optional)</Label>
                    <Input id="client" {...register("client")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" rows={3} {...register("description")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Team members</Label>
                    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                      {employees.length === 0 && (
                        <p className="p-1 text-xs text-muted-foreground">No employees yet — add some first.</p>
                      )}
                      {employees.map((e) => (
                        <label key={e._id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                          <Checkbox
                            checked={selectedMembers.includes(e._id)}
                            onCheckedChange={() => toggleMember(e._id)}
                          />
                          {e.name} <span className="text-xs text-muted-foreground">({e.email})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating..." : "Create project"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card size="sm" className="border-dashed">
        <CardContent className="grid grid-cols-1 gap-2.5 py-2.5 lg:grid-cols-[1fr_170px_170px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, client, or description"
              className="pl-9"
              aria-label="Search projects"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | ProjectJSON["status"])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on-hold">On hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deadlineFilter} onValueChange={(value) => setDeadlineFilter(value as "all" | "overdue" | "upcoming" | "no-deadline") }>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Deadline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any deadline</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="no-deadline">No deadline</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setDeadlineFilter("all");
            }}
            disabled={!hasActiveFilters}
          >
            <X /> Clear
          </Button>
          <p className="text-xs text-muted-foreground lg:col-span-full">
            Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {!loading && filteredProjects.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed bg-card/70 px-6 py-12 text-center">
            <FolderKanban className="mx-auto mb-3 size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "No projects match the current filters."
                : isAdmin
                  ? "No projects yet. Create your first one above."
                  : "You haven't been added to any projects yet."}
            </p>
          </div>
        )}
        {filteredProjects.map((p) => {
          const members = p.members as UserJSON[];
          return (
            <Link key={p._id} href={`/projects/${p._id}`}>
              <Card className={cn("h-full border-t-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-xl", projectStatusBorderColors[p.status])}>
                <CardHeader className="pb-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{p.name}</CardTitle>
                    <Badge className={cn("shrink-0 border-transparent capitalize", projectStatusColors[p.status])}>
                      {p.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex min-h-28 flex-col gap-2.5 pb-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {p.client && <span className="rounded-full bg-muted px-2 py-0.5">{p.client}</span>}
                    <span className="rounded-full bg-muted px-2 py-0.5">{p.columns.length} columns</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">Created {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                  {p.description && <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{p.description}</p>}
                  <div className="mt-auto flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" /> {members.length} member{members.length !== 1 ? "s" : ""}
                    </span>
                    {p.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" /> {new Date(p.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
