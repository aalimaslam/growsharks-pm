"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, UserX, UserCheck, Trash2, Megaphone } from "lucide-react";
import { z } from "zod";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { createEmployeeSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";
import { avatarColorFor, roleColors } from "@/lib/badgeColors";
import type { UserJSON } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

type EmployeeFormInput = z.input<typeof createEmployeeSchema>;
type EmployeeFormOutput = z.output<typeof createEmployeeSchema>;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UserJSON[]>("/api/users");
      setUsers(data);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormInput, unknown, EmployeeFormOutput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { role: "employee", title: "", isContentTeam: false },
  });

  const onSubmit = async (data: EmployeeFormOutput) => {
    try {
      await apiFetch("/api/users", { method: "POST", body: JSON.stringify(data) });
      toast.success(`Account created for ${data.name}. A welcome email was sent.`);
      reset({ name: "", email: "", role: "employee", title: "", isContentTeam: false });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create employee");
    }
  };

  const toggleActive = async (user: UserJSON) => {
    try {
      await apiFetch(`/api/users/${user._id}`, { method: "PATCH", body: JSON.stringify({ isActive: !user.isActive }) });
      toast.success(user.isActive ? "Employee deactivated" : "Employee reactivated");
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Action failed");
    }
  };

  const toggleContentTeam = async (user: UserJSON) => {
    try {
      await apiFetch(`/api/users/${user._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isContentTeam: !user.isContentTeam }),
      });
      toast.success(user.isContentTeam ? "Removed from content team" : "Added to content team");
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Action failed");
    }
  };

  const deleteUser = async (user: UserJSON) => {
    if (!confirm(`Delete ${user.name}'s account permanently? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/users/${user._id}`, { method: "DELETE" });
      toast.success("User deleted");
      load();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete user");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage your team and their access</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus /> Add employee
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add employee</DialogTitle>
              <DialogDescription>
                They&apos;ll receive a welcome email with a temporary password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title (optional)</Label>
                <Input id="title" placeholder="e.g. SEO Specialist" {...register("title")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select
                  value={watch("role") || "employee"}
                  onValueChange={(v) => setValue("role", v as "admin" | "employee")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={watch("isContentTeam") || false}
                  onCheckedChange={(checked) => setValue("isContentTeam", checked === true)}
                />
                Content team member
              </label>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No employees yet. Add your first one above.
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u._id}>
                <TableCell>
                  <Link href={`/employees/${u._id}`} className="flex items-center gap-2.5 hover:underline">
                    <Avatar className="size-7">
                      <AvatarFallback className={cn("text-xs", avatarColorFor(u.name))}>
                        {initials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{u.name}</div>
                      {u.title && <div className="text-xs text-muted-foreground">{u.title}</div>}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge className={cn("capitalize border-transparent", roleColors[u.role])}>{u.role}</Badge>
                </TableCell>
                <TableCell>
                  {u.isContentTeam ? (
                    <Badge className="border-transparent bg-accent-violet-soft text-accent-violet">
                      <Megaphone className="size-3" /> Content
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      "border-transparent",
                      u.isActive ? "bg-accent-cyan-soft text-accent-cyan" : "bg-accent-pink-soft text-accent-pink"
                    )}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleContentTeam(u)}>
                      <Megaphone /> {u.isContentTeam ? "Unmark content" : "Mark content"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                      {u.isActive ? (
                        <>
                          <UserX /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck /> Reactivate
                        </>
                      )}
                    </Button>
                    {session?.user?.id !== u._id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteUser(u)}
                      >
                        <Trash2 /> Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
