import { NextResponse } from "next/server";
import { AppointmentAvailabilityError, getPublicAppointmentAvailability } from "@/lib/appointment-data";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseJsonRequest } from "@/lib/security/validation";
import { appointmentAvailabilitySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const bucket = await rateLimit(`appointment-availability:${ip}`, 40, 60_000);
  if (!bucket.allowed) {
    return NextResponse.json({ error: "Too many availability checks. Try again shortly." }, { status: 429 });
  }

  const parsed = await parseJsonRequest(request, appointmentAvailabilitySchema);
  if (parsed.response) return parsed.response;

  try {
    const availability = await getPublicAppointmentAvailability(parsed.data);
    return NextResponse.json(availability, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    if (error instanceof AppointmentAvailabilityError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
