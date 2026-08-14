import { LayoutDashboard, FolderKanban, Users, BarChart3, Wallet, type LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
}

export const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/projects", label: "Projects", icon: FolderKanban, adminOnly: false },
  { href: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { href: "/finance", label: "Finance", icon: Wallet, adminOnly: true },
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
];
