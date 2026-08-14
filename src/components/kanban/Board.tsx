"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { Column } from "@/components/kanban/Column";
import { TaskCard } from "@/components/kanban/TaskCard";
import { TaskDetailDrawer } from "@/components/kanban/TaskDetailDrawer";
import { NewTaskDialog } from "@/components/kanban/NewTaskDialog";
import type { ProjectJSON, TaskJSON, UserJSON } from "@/types";

interface BoardProps {
  project: ProjectJSON;
  initialTasks: TaskJSON[];
  currentUserId: string;
  isAdmin: boolean;
  initialOpenTaskId?: string | null;
}

export function Board({ project, initialTasks, currentUserId, isAdmin, initialOpenTaskId }: BoardProps) {
  const [tasks, setTasks] = useState<TaskJSON[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskJSON | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId ?? null);
  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null);

  const members = project.members as UserJSON[];
  const columns = [...project.columns].sort((a, b) => a.order - b.order);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map: Record<string, TaskJSON[]> = {};
    for (const col of columns) map[col.id] = [];
    for (const t of tasks) {
      if (!map[t.columnId]) map[t.columnId] = [];
      map[t.columnId].push(t);
    }
    for (const key of Object.keys(map)) map[key].sort((a, b) => a.order - b.order);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, project.columns]);

  const findColumnOf = (id: string): string | null => {
    if (id.startsWith("column:")) return id.replace("column:", "");
    const t = tasks.find((t) => t._id === id);
    return t?.columnId ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const t = tasks.find((t) => t._id === event.active.id);
    setActiveTask(t ?? null);
  };

  const persistColumn = async (columnId: string, orderedTasks: TaskJSON[]) => {
    await Promise.all(
      orderedTasks.map((task, index) => {
        const needsColumnUpdate = task.columnId !== columnId;
        const needsOrderUpdate = task.order !== index;
        if (!needsColumnUpdate && !needsOrderUpdate) return null;
        return apiFetch(`/api/tasks/${task._id}`, {
          method: "PATCH",
          body: JSON.stringify({ columnId, order: index }),
        });
      })
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeTaskObj = tasks.find((t) => t._id === active.id);
    if (!activeTaskObj) return;

    const destColumn = findColumnOf(String(over.id));
    if (!destColumn) return;

    const sourceColumn = activeTaskObj.columnId;

    const withoutActive = tasks.filter((t) => t._id !== activeTaskObj._id);
    const destTasks = withoutActive
      .filter((t) => t.columnId === destColumn)
      .sort((a, b) => a.order - b.order);

    let insertIndex = destTasks.length;
    if (!String(over.id).startsWith("column:")) {
      const overIndex = destTasks.findIndex((t) => t._id === over.id);
      if (overIndex !== -1) insertIndex = overIndex;
    }

    const moved = { ...activeTaskObj, columnId: destColumn };
    destTasks.splice(insertIndex, 0, moved);

    const reindexedDest = destTasks.map((t, i) => ({ ...t, order: i }));
    const others = withoutActive.filter((t) => t.columnId !== destColumn);
    const nextTasks = [...others, ...reindexedDest];

    const prevTasks = tasks;
    setTasks(nextTasks);

    try {
      await persistColumn(destColumn, reindexedDest);
      if (sourceColumn !== destColumn) {
        const sourceTasks = withoutActive
          .filter((t) => t.columnId === sourceColumn)
          .sort((a, b) => a.order - b.order)
          .map((t, i) => ({ ...t, order: i }));
        await persistColumn(sourceColumn, sourceTasks);
      }
    } catch (err) {
      setTasks(prevTasks);
      toast.error(err instanceof ApiClientError ? err.message : "Failed to move task");
    }
  };

  const handleTaskCreated = (task: TaskJSON) => {
    setTasks((prev) => [...prev, task]);
  };

  const handleTaskUpdated = (task: TaskJSON) => {
    setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
  };

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) => prev.filter((t) => t._id !== id));
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex h-full items-start gap-2.5 overflow-x-auto p-3 sm:p-4 lg:p-4">
          {columns.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              name={col.name}
              tasks={grouped[col.id] || []}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onTaskClick={(task) => setOpenTaskId(task._id)}
              onAddTask={() => setNewTaskColumn(col.id)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} canMove onClick={() => {}} />}
        </DragOverlay>
      </DndContext>

      <TaskDetailDrawer
        taskId={openTaskId}
        onOpenChange={(open) => !open && setOpenTaskId(null)}
        columns={project.columns}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />

      {newTaskColumn && (
        <NewTaskDialog
          open={!!newTaskColumn}
          onOpenChange={(open) => !open && setNewTaskColumn(null)}
          projectId={project._id}
          columnId={newTaskColumn}
          members={members}
          onCreated={handleTaskCreated}
        />
      )}
    </>
  );
}
