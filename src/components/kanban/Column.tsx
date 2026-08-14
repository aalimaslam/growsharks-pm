"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/kanban/TaskCard";
import type { TaskJSON, UserJSON } from "@/types";

interface ColumnProps {
  id: string;
  name: string;
  tasks: TaskJSON[];
  currentUserId: string;
  isAdmin: boolean;
  onTaskClick: (task: TaskJSON) => void;
  onAddTask: () => void;
}

export function Column({ id, name, tasks, currentUserId, isAdmin, onTaskClick, onAddTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${id}` });

  return (
    <div className="panel-shadow flex max-h-full w-80 shrink-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card/90">
      <div className="flex items-center justify-between border-b bg-muted/45 px-3 py-2.5">
        <h3 className="text-sm font-semibold tracking-tight">{name}</h3>
        <span className="rounded-full border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isOver ? "bg-accent-blue-soft/70" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => {
            const assigneeId =
              typeof task.assignee === "string" ? task.assignee : (task.assignee as UserJSON | null)?._id;
            const createdById =
              typeof task.createdBy === "string" ? task.createdBy : (task.createdBy as UserJSON)?._id;
            const canMove = isAdmin || assigneeId === currentUserId || createdById === currentUserId;
            return (
              <TaskCard key={task._id} task={task} canMove={canMove} onClick={() => onTaskClick(task)} />
            );
          })}
        </SortableContext>
      </div>
      <div className="border-t bg-muted/30 p-2">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={onAddTask}>
          <Plus className="size-4" /> Add task
        </Button>
      </div>
    </div>
  );
}
