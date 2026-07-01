import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/api-session";
import { liveStream } from "@/lib/live-data";
import {
  createCustomerSupportMessage,
  getSupportChatPayload,
  SupportChatAuthError,
  SupportChatClosedError,
  supportChatChangeMatches
} from "@/lib/support-chat";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

const sessionIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{8,80}$/).optional().nullable();
const supportChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(1200),
  sessionId: sessionIdSchema
});

export async function GET(request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  const url = new URL(request.url);
  const sessionId = sessionIdSchema.catch(null).parse(url.searchParams.get("sessionId"));
  const session = await getSessionUser();
  const stream = url.searchParams.get("stream") === "1";
  const skipInitial = url.searchParams.get("skipInitial") === "1";
  const payload = () => getSupportChatPayload({ ticketId, sessionId, session });

  try {
    const initialPayload = await payload();
    if (!initialPayload) return json({ error: "Support chat not found." }, 404);
    if (!stream) return json(initialPayload);

    return new Response(
      liveStream("support-chat", payload, request.signal, {
        sendInitialPayload: !skipInitial,
        changeFilter: (change) => supportChatChangeMatches(ticketId, change)
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
  } catch (error) {
    return supportChatErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { ticketId } = await context.params;
  const parsed = supportChatMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Send a short message." }, 400);

  try {
    const session = await getSessionUser();
    const payload = await createCustomerSupportMessage({
      ticketId,
      body: parsed.data.body,
      sessionId: parsed.data.sessionId,
      session
    });
    if (!payload) return json({ error: "Support chat not found." }, 404);
    return json(payload);
  } catch (error) {
    return supportChatErrorResponse(error);
  }
}

function supportChatErrorResponse(error: unknown) {
  if (error instanceof SupportChatAuthError) return json({ error: "Forbidden" }, 403);
  if (error instanceof SupportChatClosedError) return json({ error: error.message }, 409);
  return json({ error: "Could not load support chat." }, 500);
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
