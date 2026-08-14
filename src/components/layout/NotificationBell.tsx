"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { NotificationJSON } from "@/types";

function isTaskNotification(type: string) {
  return ["task-assigned", "task-completed", "task-comment"].includes(type);
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationJSON[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) setNotifications(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live-pushed via SSE instead of polling — the server sends a new
  // notification the moment it's created (src/lib/notifyBus.ts).
  // EventSource reconnects automatically on its own if the connection drops.
  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.onmessage = (event) => {
      const notification = JSON.parse(event.data) as NotificationJSON;
      setNotifications((prev) => [notification, ...prev.filter((n) => n._id !== notification._id)]);
    };
    return () => source.close();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex size-2 rounded-full bg-destructive" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="xs"
                className="h-6 text-xs"
                onClick={async () => {
                  await fetch("/api/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ all: true }),
                  });
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                }}
              >
                <CheckCheck className="size-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {notifications.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">No notifications yet</p>
        )}
        {notifications.slice(0, 15).map((n) => (
          <DropdownMenuItem
            key={n._id}
            className={`flex flex-col items-start gap-1 whitespace-normal ${n.read ? "opacity-70" : "bg-muted/40"}`}
            render={
              <div className="flex w-full flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm leading-snug">{n.message}</span>
                  {!n.read && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 size-6"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markOneRead(n._id);
                      }}
                    >
                      <CheckCheck className="size-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                  {isTaskNotification(n.type) && n.link && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 text-xs px-2"
                      render={
                        <Link href={n.link} onClick={() => setOpen(false)}>
                          <ExternalLink className="size-3 mr-1" />
                          View
                        </Link>
                      }
                    />
                  )}
                </div>
              </div>
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
