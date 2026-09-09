import { NextResponse } from "next/server";
import {
  CUSTOMER_ACCOUNT_RETENTION_NOTICE
} from "@/lib/customer-account-policy";
import {
  getCustomerAccountExportData,
  requireVerifiedCustomerAccount
} from "@/lib/customer-account";
import { safeLog } from "@/lib/security/safe-logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authorization = await requireVerifiedCustomerAccount();
    if ("response" in authorization) return authorization.response;

    const { user } = authorization;
    const portalData = await getCustomerAccountExportData(user);
    const exportedAt = new Date();

    return NextResponse.json(
      {
        exportVersion: 1,
        exportedAt: exportedAt.toISOString(),
        account: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt,
          phoneVerifiedAt: user.phoneVerifiedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        ...portalData,
        retentionNotice: CUSTOMER_ACCOUNT_RETENTION_NOTICE
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="vyapaarmate-customer-data-${exportedAt
            .toISOString()
            .slice(0, 10)}.json"`
        }
      }
    );
  } catch (error) {
    safeLog("error", "Customer data export failed", { error });
    return NextResponse.json(
      { error: "We could not prepare your data export. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
