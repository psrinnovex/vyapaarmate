import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/api-session";
import { getPilotReport } from "@/lib/pilot-data";
import { PilotPage } from "@/components/admin/pilot-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!await getAdminSession()) redirect("/login?type=admin");
  return <PilotPage initialReport={await getPilotReport()} />;
}
