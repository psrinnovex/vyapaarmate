import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/api-session";
import { writeAuditLog } from "@/lib/audit";
import { adminPlatformPaymentSettingsSchema } from "@/lib/validations";
import { getOnlinePaymentConfig } from "@/services/online-payments";
import { savePlatformPaymentSettings } from "@/services/platform-payment-settings";

export const dynamic = "force-dynamic";

function publicSettings(config: Awaited<ReturnType<typeof getOnlinePaymentConfig>>) {
  return {
    directUpiEnabled: config.directUpiEnabled,
    upiId: config.upiId,
    upiName: config.upiName,
    gatewayProvider: config.gatewayProvider,
    activeProvider: config.provider,
    updatedAt: config.updatedAt?.toISOString() ?? null
  };
}

function maskedUpiId(upiId: string | null) {
  if (!upiId) return null;
  const [handle, provider] = upiId.split("@");
  return `${handle.slice(0, 2)}***@${provider}`;
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(publicSettings(await getOnlinePaymentConfig()));
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = adminPlatformPaymentSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await savePlatformPaymentSettings({
    directUpiEnabled: parsed.data.directUpiEnabled,
    upiId: parsed.data.upiId ?? null,
    upiName: parsed.data.upiName,
    updatedByUserId: session.id
  });

  const config = await getOnlinePaymentConfig();
  await writeAuditLog({
    userId: session.id,
    action: "PLATFORM_PAYMENT_SETTINGS_UPDATED",
    entity: "PlatformPaymentSettings",
    entityId: "platform",
    metadata: {
      directUpiEnabled: config.directUpiEnabled,
      upiId: maskedUpiId(config.upiId),
      upiName: config.upiName,
      activeProvider: config.provider,
      gatewayProvider: config.gatewayProvider
    }
  });

  return NextResponse.json(publicSettings(config));
}
