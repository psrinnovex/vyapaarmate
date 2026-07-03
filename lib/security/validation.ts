import type { z } from "zod";
import type { NextResponse } from "next/server";
import { apiError, apiValidationError } from "@/lib/security/api-response";

export async function parseJsonRequest<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<
  | { data: z.infer<TSchema>; response?: never }
  | { data?: never; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: apiError("Request body must be valid JSON.", 400) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { response: apiValidationError(parsed.error) };
  }

  return { data: parsed.data };
}
