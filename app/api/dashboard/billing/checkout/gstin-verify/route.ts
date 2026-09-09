import { NextResponse } from "next/server";
import { rejectMobileBusinessSubscriptionRequest, requireBusinessSession } from "@/lib/api-session";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";

export const dynamic = "force-dynamic";

function formatValidResponse() {
  return NextResponse.json({
    formatValid: true,
    providerVerified: false,
    businessName: null,
    message: "GSTIN format is valid, but provider verification is not confirmed."
  });
}

export async function POST(request: Request) {
  const mobileDenied = await rejectMobileBusinessSubscriptionRequest();
  if (mobileDenied) return mobileDenied;
  const auth = await requireBusinessSession("business:billing:read");
  if (auth.response) return auth.response;

  const body = await request.json();
  const gstin = typeof body.gstin === "string" ? normalizeGstin(body.gstin) : "";

  if (!gstin || !isValidGstin(gstin)) {
    return NextResponse.json(
      {
        formatValid: false,
        providerVerified: false,
        businessName: null,
        error: "Invalid GSTIN format"
      },
      { status: 400 }
    );
  }

  // Attempt to verify via Cashfree Verification API
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const env = process.env.CASHFREE_ENV === "production" ? "api.cashfree.com" : "sandbox.cashfree.com";

  if (!appId || !secretKey) {
    return formatValidResponse();
  }

  try {
    const response = await fetch(`https://${env}/verification/gstin`, {
      method: "POST",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ GSTIN: gstin })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      legal_name?: unknown;
      trade_name?: unknown;
      business_name?: unknown;
    };
    const providerBusinessName = [payload.legal_name, payload.trade_name, payload.business_name]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0)
      ?.trim() ?? null;

    if (!response.ok || !providerBusinessName) {
      return formatValidResponse();
    }

    return NextResponse.json({
      formatValid: true,
      providerVerified: true,
      businessName: providerBusinessName,
      message: "GSTIN verified by the configured provider."
    });
  } catch {
    return formatValidResponse();
  }
}
