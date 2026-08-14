"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import type { ProjectJSON, UserJSON, ColumnJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditTrail } from "@/components/AuditTrail";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectJSON | null>(null);
  const [employees, setEmployees] = useState<UserJSON[]>([]);
  const [columns, setColumns] = useState<ColumnJSON[]>([]);
  const [saving, setSaving] = useState(false);
  const [auditVersion, setAuditVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([
        apiFetch<ProjectJSON>(`/api/projects/${id}`),
        apiFetch<UserJSON[]>("/api/users"),
      ]);
      setProject(p);
      setColumns(p.columns);
      setEmployees(u.filter((e) => e.isActive));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load project");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!project) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const memberIds = (project.members as UserJSON[]).map((m) => m._id);

  const saveDetails = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const updated = await apiFetch<ProjectJSON>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setProject(updated);
      setAuditVersion((v) => v + 1);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (userId: string) => {
    const next = memberIds.includes(userId) ? memberIds.filter((m) => m !== userId) : [...memberIds, userId];
    saveDetails({ members: next });
  };

  const addColumn = () => {
    const id_ = `col-${Date.now()}`;
    setColumns((c) => [...c, { id: id_, name: "New column", order: c.length }]);
  };

  const removeColumn = (colId: string) => {
    setColumns((c) => c.filter((col) => col.id !== colId).map((col, i) => ({ ...col, order: i })));
  };

  const renameColumn = (colId: string, name: string) => {
    setColumns((c) => c.map((col) => (col.id === colId ? { ...col, name } : col)));
  };

  const moveColumn = (index: number, dir: -1 | 1) => {
    setColumns((c) => {
      const next = [...c];
      const target = index + dir;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((col, i) => ({ ...col, order: i }));
    });
  };

  const saveColumns = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${id}/columns`, {
        method: "PATCH",
        body: JSON.stringify({ columns }),
      });
      setAuditVersion((v) => v + 1);
      toast.success("Columns updated");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to save columns");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-6">
      <Link href={`/projects/${id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="size-4" /> Back to board
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{project.name} settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input
              defaultValue={project.name}
              onBlur={(e) => e.target.value !== project.name && saveDetails({ name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Client</Label>
            <Input
              defaultValue={project.client}
              onBlur={(e) => e.target.value !== project.client && saveDetails({ client: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              defaultValue={project.description}
              onBlur={(e) => e.target.value !== project.description && saveDetails({ description: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={project.status} onValueChange={(v) => saveDetails({ status: v as ProjectJSON["status"] })}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on-hold">On hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Board columns</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {columns.map((col, i) => (
            <div key={col.id} className="flex items-center gap-2">
              <Input value={col.name} onChange={(e) => renameColumn(col.id, e.target.value)} className="flex-1" />
              <Button variant="ghost" size="icon" onClick={() => moveColumn(i, -1)} disabled={i === 0}>
                <ArrowUp className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1}>
                <ArrowDown className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => removeColumn(col.id)} disabled={columns.length <= 1}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between mt-2">
            <Button variant="outline" size="sm" onClick={addColumn}>
              <Plus /> Add column
            </Button>
            <Button size="sm" onClick={saveColumns} disabled={saving}>
              <Save /> Save columns
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {employees.map((e) => (
            <label key={e._id} className="flex items-center gap-2 text-sm px-1 py-1.5 rounded hover:bg-muted cursor-pointer">
              <Checkbox checked={memberIds.includes(e._id)} onCheckedChange={() => toggleMember(e._id)} />
              {e.name} <span className="text-xs text-muted-foreground">({e.email})</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTrail entityType="project" entityId={id} refreshKey={auditVersion} />
        </CardContent>
      </Card>
    </div>
  );
}
