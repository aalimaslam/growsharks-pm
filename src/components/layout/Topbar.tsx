"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User as UserIcon, Menu, Waves, Search } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { navLinks, isNavLinkVisible } from "@/components/layout/nav-links";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { avatarColorFor } from "@/lib/badgeColors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  name: string;
  email: string;
  role: "admin" | "employee";
  isContentTeam: boolean;
}

type SearchResults = {
  projects: { id: string; name: string }[];
  tasks: { id: string; title: string; projectName: string }[];
  people: { id: string; name: string; email: string }[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Topbar({ name, email, role, isContentTeam }: TopbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ projects: [], tasks: [], people: [] });
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ projects: [], tasks: [], people: [] });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        if (!controller.signal.aborted) setResults({ projects: [], tasks: [], people: [] });
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const hasResults = results.projects.length + results.tasks.length + results.people.length > 0;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/80 bg-card/80 px-3 backdrop-blur-xl md:px-5">
      <div className="flex items-center gap-3 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="m-3 flex h-12 items-center gap-3 rounded-lg border border-sidebar-border bg-white/5 px-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-white text-sidebar">
                <Waves className="size-4" />
              </div>
              <span className="font-semibold tracking-tight">GrowSharks</span>
            </div>
            <nav className="flex flex-col gap-1 p-3 pt-0">
              {navLinks
                .filter((l) => isNavLinkVisible(l, { role, isContentTeam }))
                .map((link) => {
                  const active = pathname === link.href || pathname.startsWith(link.href + "/");
                  const Icon = link.icon;
                  return (
                     <Link
                       key={link.href}
                       href={link.href}
                       onClick={() => setMobileOpen(false)}
                       className={cn(
                         "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                         active
                           ? "bg-white text-sidebar shadow-sm"
                           : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                       )}
                     >
                      <Icon className="size-4.5" />
                      {link.label}
                    </Link>
                  );
                })}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="font-semibold tracking-tight">GrowSharks</span>
      </div>
      <div className="hidden min-w-0 flex-1 items-center md:flex">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border border-border bg-background/80 pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
            placeholder="Search projects, tasks, people"
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
          />
          {searchFocused && query.trim() && (
            <div className="panel-shadow absolute left-0 right-0 top-10 z-50 overflow-hidden rounded-lg border border-border bg-card">
              {!hasResults && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">No matches</div>
              )}
              {results.projects.map((project) => (
                <Link
                  key={`project-${project.id}`}
                  href={`/projects/${project.id}`}
                  className="block border-b px-3 py-2.5 text-sm hover:bg-muted/50"
                >
                  <span className="block font-medium">{project.name}</span>
                  <span className="text-xs text-muted-foreground">Project</span>
                </Link>
              ))}
              {results.tasks.map((task) => (
                <Link
                  key={`task-${task.id}`}
                  href={`/tasks/${task.id}`}
                  className="block border-b px-3 py-2.5 text-sm hover:bg-muted/50"
                >
                  <span className="block font-medium">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.projectName || "Task"}</span>
                </Link>
              ))}
              {results.people.map((person) => (
                <Link
                  key={`person-${person.id}`}
                  href={`/employees/${person.id}`}
                  className="block border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted/50"
                >
                  <span className="block font-medium">{person.name}</span>
                  <span className="text-xs text-muted-foreground">{person.email}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-2 rounded-md border border-border bg-card px-1.5 py-1 shadow-sm outline-none transition hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30">
                <Avatar className="size-8">
                  <AvatarFallback className={cn("text-xs", avatarColorFor(name))}>{initials(name)}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate pr-1 text-sm font-medium md:block">{name}</span>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="font-medium">{name}</span>
                <span className="text-xs font-normal text-muted-foreground">{email}</span>
                <span className="text-xs font-normal text-muted-foreground capitalize">{role}</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link href="/profile">
                  <UserIcon /> Profile
                </Link>
              }
            />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
