import { AdminSupportPage } from "@/components/admin/admin-pages";
import { getSessionUser } from "@/lib/api-session";

export default async function AdminSupportRoute() {
  const session = await getSessionUser();
  return <AdminSupportPage canManageAgents={session?.role === "SUPER_ADMIN"} />;
}
