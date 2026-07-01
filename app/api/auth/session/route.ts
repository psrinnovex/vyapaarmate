import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();

  return NextResponse.json(
    { user },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
