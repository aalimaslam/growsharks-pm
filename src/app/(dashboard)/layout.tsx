import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { name, email, role, isContentTeam } = session.user;

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="print:hidden">
        <Sidebar role={role} isContentTeam={isContentTeam} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-background md:rounded-l-2xl print:rounded-none print:bg-white">
        <div className="print:hidden">
          <Topbar name={name || email || "User"} email={email || ""} role={role} isContentTeam={isContentTeam} />
        </div>
        <main className="app-surface flex-1 overflow-y-auto print:overflow-visible">{children}</main>
      </div>
    </div>
  );
}
