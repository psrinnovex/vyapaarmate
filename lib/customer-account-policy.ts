import { z } from "zod";
import { CUSTOMER_ACCOUNT_DELETE_CONFIRMATION } from "@/lib/customer-account-copy";

export { CUSTOMER_ACCOUNT_DELETE_CONFIRMATION, CUSTOMER_ACCOUNT_RETENTION_NOTICE } from "@/lib/customer-account-copy";

export const customerAccountDeletionSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(256, "Password is too long."),
    confirmation: z.literal(CUSTOMER_ACCOUNT_DELETE_CONFIRMATION)
  })
  .strict();

export function isVerifiedCustomerAccount(
  user: {
    role: string;
    emailVerifiedAt: Date | string | null;
    phoneVerifiedAt: Date | string | null;
  },
  phoneVerificationRequired: boolean
) {
  return (
    user.role === "CUSTOMER" &&
    Boolean(user.emailVerifiedAt) &&
    (!phoneVerificationRequired || Boolean(user.phoneVerifiedAt))
  );
}
