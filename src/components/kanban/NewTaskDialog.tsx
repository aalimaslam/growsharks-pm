"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { createTaskSchema } from "@/lib/validators";
import type { TaskJSON, UserJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaskFormInput = z.input<typeof createTaskSchema>;
type TaskFormOutput = z.output<typeof createTaskSchema>;

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  columnId: string;
  members: UserJSON[];
  onCreated: (task: TaskJSON) => void;
}

export function NewTaskDialog({ open, onOpenChange, projectId, columnId, members, onCreated }: NewTaskDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormInput, unknown, TaskFormOutput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { project: projectId, columnId, priority: "medium", description: "" },
  });

  const onSubmit = async (data: TaskFormOutput) => {
    try {
      const task = await apiFetch<TaskJSON>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ ...data, project: projectId, columnId }),
      });
      toast.success("Task created");
      onCreated(task);
      reset({ project: projectId, columnId, priority: "medium", description: "", title: "" });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="title" className="text-xs font-medium">Title</Label>
            <Input id="title" {...register("title")} className="h-8 text-sm rounded-md" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="description" className="text-xs font-medium">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} className="text-sm rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Assignee</Label>
              <Select
                value={watch("assignee") || "unassigned"}
                onValueChange={(v) => setValue("assignee", v === "unassigned" ? null : v)}
              >
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
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
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium">Priority</Label>
              <Select
                value={watch("priority") || "medium"}
                onValueChange={(v) => setValue("priority", v as TaskFormInput["priority"])}
              >
                <SelectTrigger className="h-8 text-sm rounded-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dueDate" className="text-xs font-medium">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                onChange={(e) =>
                  setValue("dueDate", e.target.value ? new Date(e.target.value).toISOString() : null)
                }
                className="h-8 text-sm rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="estimatedHours" className="text-xs font-medium">Est. hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 8"
                onChange={(e) => setValue("estimatedHours", e.target.value ? Number(e.target.value) : null)}
                className="h-8 text-sm rounded-md"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} size="sm">
              {isSubmitting ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
