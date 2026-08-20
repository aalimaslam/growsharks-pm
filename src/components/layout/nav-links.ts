import { LayoutDashboard, FolderKanban, Users, BarChart3, Wallet, ReceiptText, CalendarDays, type LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  // Visible to admins and users flagged isContentTeam, hidden from everyone else.
  contentTeamOnly?: boolean;
}

export const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/projects", label: "Projects", icon: FolderKanban, adminOnly: false },
  { href: "/content", label: "Content", icon: CalendarDays, adminOnly: false, contentTeamOnly: true },
  { href: "/expenses", label: "Expenses", icon: ReceiptText, adminOnly: false },
  { href: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { href: "/finance", label: "Finance", icon: Wallet, adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
];

export function isNavLinkVisible(
  link: NavLink,
  ctx: { role: "admin" | "employee"; isContentTeam: boolean }
): boolean {
  if (link.adminOnly && ctx.role !== "admin") return false;
  if (link.contentTeamOnly && ctx.role !== "admin" && !ctx.isContentTeam) return false;
  return true;
}
