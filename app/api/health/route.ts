import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      release: "ml-production-lifecycle",
      commit: process.env.NEXT_PUBLIC_RELEASE_COMMIT ?? "unknown",
      productionGates: {
        databaseMigration: process.env.NEXT_PUBLIC_PRODUCTION_MIGRATION_GATE ?? "not-verified",
        cronSecret: process.env.NEXT_PUBLIC_PRODUCTION_CRON_GATE ?? "not-verified"
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
