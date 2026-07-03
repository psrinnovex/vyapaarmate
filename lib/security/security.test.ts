import assert from "node:assert/strict";
import test from "node:test";
import { Role } from "@prisma/client";
import { canAccessBusiness } from "@/lib/security/authz";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { sanitizeLogMetadata } from "@/lib/security/safe-logger";

test("tenant access allows owners only for their own business", () => {
  assert.equal(canAccessBusiness({ role: Role.OWNER, businessId: "biz_1" }, "biz_1"), true);
  assert.equal(canAccessBusiness({ role: Role.OWNER, businessId: "biz_1" }, "biz_2"), false);
  assert.equal(canAccessBusiness({ role: Role.SUPPORT_AGENT, businessId: null }, "biz_1"), false);
  assert.equal(canAccessBusiness({ role: Role.SUPER_ADMIN, businessId: null }, "biz_1"), true);
});

test("cron authorization uses the bearer secret when configured", () => {
  const originalSecret = process.env.CRON_SECRET;

  try {
    process.env.CRON_SECRET = "test-cron-secret";

    assert.equal(isCronRequestAuthorized(new Request("https://example.com/api/jobs/test")), false);
    assert.equal(
      isCronRequestAuthorized(
        new Request("https://example.com/api/jobs/test", {
          headers: { authorization: "Bearer test-cron-secret" }
        })
      ),
      true
    );
    assert.equal(
      isCronRequestAuthorized(
        new Request("https://example.com/api/jobs/test", {
          headers: { authorization: "Bearer test-cron-secret-wrong" }
        })
      ),
      false
    );
  } finally {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  }
});

test("safe log metadata redacts secrets and masks common PII", () => {
  const sanitized = sanitizeLogMetadata({
    email: "customer@example.com",
    phone: "+919876543210",
    authorization: "Bearer secret",
    nested: {
      cashfreeSignature: "signature",
      bankAccountNumber: "1234567890"
    }
  }) as Record<string, unknown>;

  assert.equal(sanitized.email, "cu******@example.com");
  assert.equal(sanitized.phone, "+91 ******3210");
  assert.equal(sanitized.authorization, "[redacted]");
  assert.deepEqual(sanitized.nested, {
    cashfreeSignature: "[redacted]",
    bankAccountNumber: "****7890"
  });
});
