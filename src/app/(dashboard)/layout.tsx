import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardShell from "@/components/dashboard-shell";
import { isMockMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  return <DashboardShell email={user.email ?? ""} isDemo={isMockMode()}>{children}</DashboardShell>;
}
