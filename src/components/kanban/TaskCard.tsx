"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Clock, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { priorityColors, priorityBorderColors, avatarColorFor } from "@/lib/badgeColors";
import type { TaskJSON, UserJSON } from "@/types";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

interface TaskCardProps {
  task: TaskJSON;
  canMove: boolean;
  onClick: () => void;
}

export function TaskCard({ task, canMove, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
    disabled: !canMove,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee = task.assignee as UserJSON | null;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.columnId !== "done";

  return (
     <div
       ref={setNodeRef}
       style={style}
       className={cn(
         "group flex cursor-pointer flex-col gap-2 rounded-md border border-l-4 bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md",
         priorityBorderColors[task.priority],
         isDragging && "opacity-50"
       )}
       onClick={onClick}
     >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug tracking-tight">{task.title}</p>
        {canMove && (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 cursor-grab rounded-md p-0.5 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag task"
          >
            <GripVertical className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-1.5">
        <Badge className={cn("capitalize text-[11px] px-1.5 py-0", priorityColors[task.priority])} variant="secondary">
          {task.priority}
        </Badge>
        {task.dueDate && (
          <span className={cn("text-[11px]", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between border-t pt-1.5">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          {task.comments.length > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <MessageSquare className="size-3.5" /> {task.comments.length}
            </span>
          )}
          {(task.timeLogs.length > 0 || task.estimatedHours) && (
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="size-3.5" />
              {task.timeLogs.reduce((s, l) => s + l.hours, 0)}h
              {task.estimatedHours ? ` / ${task.estimatedHours}h est.` : ""}
            </span>
          )}
        </div>
        {assignee && (
          <Avatar className="size-6">
            <AvatarFallback className={cn("text-[10px]", avatarColorFor(assignee.name))}>
              {initials(assignee.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
