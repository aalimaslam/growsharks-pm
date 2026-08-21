"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type { AuditLogJSON } from "@/types";

const ENDPOINT_SEGMENT: Record<"task" | "project" | "finance" | "invoice", string> = {
  task: "tasks",
  project: "projects",
  finance: "finance",
  invoice: "invoices",
};

interface AuditTrailProps {
  entityType: "task" | "project" | "finance" | "invoice";
  entityId: string;
  // Bump this (e.g. a counter) after a mutation on the same page/drawer so
  // the trail refetches without needing a full remount.
  refreshKey?: number | string;
}

export function AuditTrail({ entityType, entityId, refreshKey }: AuditTrailProps) {
  const [entries, setEntries] = useState<AuditLogJSON[] | null>(null);

  // Switching entity shows a loading state; a refreshKey bump (a mutation on
  // the same page) just silently refetches in place, no flicker.
  useEffect(() => {
    setEntries(null);
  }, [entityType, entityId]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<AuditLogJSON[]>(`/api/${ENDPOINT_SEGMENT[entityType]}/${entityId}/audit`)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setEntries((prev) => prev ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, refreshKey]);

  if (entries === null) return <p className="text-xs text-muted-foreground">Loading activity...</p>;
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">No activity yet.</p>;

  return (
    <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto">
      {entries.map((e) => (
        <div key={e._id} className="flex items-start gap-2 text-xs">
          <History className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground/90 leading-snug">{e.message}</p>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
