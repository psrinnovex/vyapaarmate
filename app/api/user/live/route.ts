import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-session";
import { liveStream } from "@/lib/live-data";
import type { LiveChangePayload } from "@/lib/postgres-live-events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserLiveScope = "businesses" | "bookings" | "profile" | "settings";

function userLiveScope(value: string | null): UserLiveScope {
  if (value === "bookings" || value === "profile" || value === "settings") return value;
  return "businesses";
}

function compactPhone(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function customerChangeMatches(change: LiveChangePayload, user: { id: string; email: string; phone: string | null; phoneVerifiedAt: Date | null }) {
  if (change.userId === user.id) return true;
  if (change.customerEmail && change.customerEmail.toLowerCase() === user.email.toLowerCase()) return true;

  const userPhone = user.phoneVerifiedAt ? compactPhone(user.phone) : "";
  const changePhone = compactPhone(change.customerPhone);
  return Boolean(userPhone && changePhone && userPhone === changePhone);
}

function userChangeMatches(scope: UserLiveScope, user: { id: string; email: string; phone: string | null; phoneVerifiedAt: Date | null }) {
  return (change: LiveChangePayload) => {
    if (scope === "businesses") {
      return ["Business", "BusinessImage", "BusinessServiceType", "MenuCategory", "MenuItem", "MenuItemImage"].includes(change.table);
    }

    if (customerChangeMatches(change, user)) return true;
    if (scope === "profile" || scope === "settings") return change.table === "User" && change.userId === user.id;

    return false;
  };
}

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id, role: "CUSTOMER" },
    select: { id: true, email: true, phone: true, phoneVerifiedAt: true }
  });
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";
  const scope = userLiveScope(url.searchParams.get("scope"));
  const payload = () => Promise.resolve({ syncedAt: new Date().toISOString() });

  if (!stream) {
    return NextResponse.json(await payload());
  }

  return new Response(
    liveStream("user", payload, request.signal, {
      sendInitialPayload: !skipInitial,
      changeFilter: userChangeMatches(scope, user)
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    }
  );
}
