import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/api-session";
import { submitSupportChatFeedback, SupportChatAuthError, SupportChatClosedError } from "@/lib/support-chat";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

const supportChatFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().nullable(),
  sessionId: z.string().trim().regex(/^[a-zA-Z0-9_-]{8,80}$/).optional().nullable()
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = supportChatFeedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Choose a rating from 1 to 5." }, 400);

  const { ticketId } = await context.params;
  const session = await getSessionUser();

  try {
    const payload = await submitSupportChatFeedback({
      ticketId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      sessionId: parsed.data.sessionId,
      session
    });
    if (!payload) return json({ error: "Support chat not found." }, 404);
    return json(payload);
  } catch (error) {
    if (error instanceof SupportChatAuthError) return json({ error: "Forbidden" }, 403);
    if (error instanceof SupportChatClosedError) return json({ error: error.message }, 409);
    return json({ error: "Could not save feedback." }, 500);
  }
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}
