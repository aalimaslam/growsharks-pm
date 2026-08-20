"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Waves } from "lucide-react";
import { navLinks as links, isNavLinkVisible } from "@/components/layout/nav-links";

interface SidebarProps {
  role: "admin" | "employee";
  isContentTeam: boolean;
}

export function Sidebar({ role, isContentTeam }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-3 py-4 text-sidebar-foreground md:flex">
      <div className="mb-4 flex h-12 items-center gap-3 rounded-lg border border-sidebar-border bg-white/5 px-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-white text-sidebar">
          <Waves className="size-4" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-semibold tracking-tight">GrowSharks</span>
          <span className="block text-xs text-sidebar-foreground/55">Project command</span>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {links
          .filter((l) => isNavLinkVisible(l, { role, isContentTeam }))
          .map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
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
      <div className="rounded-lg border border-sidebar-border bg-white/5 p-3 text-xs leading-5 text-sidebar-foreground/60">
        <div className="mb-1 font-medium text-sidebar-foreground">Access</div>
        <span className="capitalize">{role}</span>
      </div>
    </aside>
  );
}
