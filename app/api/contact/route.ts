import { NextResponse } from "next/server";
import { z } from "zod";
import { isLaunchCity, launchMarket, launchMarketRestricted } from "@/lib/launch-policy";
import { parsePhoneNumber } from "@/lib/phone";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { safeLog } from "@/lib/security/safe-logger";
import { company } from "@/lib/site";
import { sendEmail } from "@/services/email";

export const dynamic = "force-dynamic";

const contactLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80, "Name is too long."),
  phone: z.string().trim().min(8, "Enter a valid phone number.").max(24, "Enter a valid phone number."),
  business: z.string().trim().min(2, "Enter the business type.").max(120, "Business type is too long."),
  city: z
    .string()
    .trim()
    .min(2, "Enter the city.")
    .max(80, "City is too long.")
    .refine(isLaunchCity, `Demo onboarding is currently available only in ${launchMarket.displayName}.`),
  message: z.string().trim().min(10, "Tell us a little about your business workflow.").max(2000, "Message is too long."),
  website: z.string().trim().max(200).optional().default("")
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character] ?? character;
  });
}

function leadEmail(input: {
  name: string;
  phone: string;
  business: string;
  city: string;
  message: string;
}) {
  const escapedMessage = escapeHtml(input.message).replace(/\r?\n/g, "<br />");

  return {
    subject: `New VyapaarMate demo request - ${input.city}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h1 style="font-size:22px;margin:0 0 16px">New ${escapeHtml(input.city)} demo request</h1>
        <table style="border-collapse:collapse;width:100%;max-width:640px">
          <tbody>
            <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700">Name</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(input.name)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700">Phone</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(input.phone)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700">Business type</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(input.business)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700">City</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(input.city)}</td></tr>
          </tbody>
        </table>
        <h2 style="font-size:17px;margin:20px 0 8px">Business workflow</h2>
        <p style="margin:0;max-width:640px">${escapedMessage}</p>
      </div>
    `.trim(),
    text: [
      `New VyapaarMate demo request - ${input.city}`,
      `Name: ${input.name}`,
      `Phone: ${input.phone}`,
      `Business type: ${input.business}`,
      `City: ${input.city}`,
      "",
      "Business workflow:",
      input.message
    ].join("\n")
  };
}

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the demo request details and try again.";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipBucket = await rateLimit(`contact-demo:ip:${ip}`, 5, 15 * 60_000);
  if (!ipBucket.allowed) {
    return NextResponse.json(
      { error: "Too many demo requests. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send valid demo request details." }, { status: 400 });
  }

  const parsed = contactLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: validationMessage(parsed.error) }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ error: "This demo request could not be accepted." }, { status: 400 });
  }

  const phone = parsePhoneNumber(parsed.data.phone);
  if (!phone.isValid) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const phoneBucket = await rateLimit(`contact-demo:phone:${phone.e164}`, 3, 60 * 60_000);
  if (!phoneBucket.allowed) {
    return NextResponse.json(
      { error: "Too many demo requests for this phone number. Please try again later." },
      { status: 429 }
    );
  }

  const recipient = process.env.CONTACT_LEAD_EMAIL?.trim().toLowerCase() || company.supportEmail;
  if (!z.string().email().safeParse(recipient).success) {
    safeLog("error", "Contact lead recipient is not configured correctly");
    return NextResponse.json(
      { error: "Demo requests are temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  const email = leadEmail({
    name: parsed.data.name,
    phone: phone.e164,
    business: parsed.data.business,
    city: launchMarketRestricted ? launchMarket.city : parsed.data.city.trim(),
    message: parsed.data.message
  });

  try {
    const delivery = await sendEmail({
      to: recipient,
      subject: email.subject,
      html: email.html,
      text: email.text
    });

    if (delivery.status !== "queued") {
      safeLog("warn", "Contact lead email was not accepted by the email provider", {
        deliveryStatus: delivery.status
      });
      return NextResponse.json(
        { error: "Demo requests are temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        message: launchMarketRestricted
          ? "Your demo request was sent. Our pilot team will contact you soon."
          : "Your demo request was sent. Our team will contact you soon."
      },
      { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    safeLog("error", "Contact lead email delivery failed", { error, recipient });
    return NextResponse.json(
      { error: "We could not send your demo request right now. Please try again shortly." },
      { status: 503 }
    );
  }
}
