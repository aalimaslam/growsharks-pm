import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, email, role } = session.user;

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col bg-background md:rounded-l-2xl">
        <Topbar name={name || email || "User"} email={email || ""} role={role} />
        <main className="app-surface flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
