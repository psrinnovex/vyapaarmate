import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_ACCOUNT_DELETE_CONFIRMATION,
  customerAccountDeletionSchema,
  isVerifiedCustomerAccount
} from "@/lib/customer-account-policy";

const verifiedCustomer = {
  role: "CUSTOMER",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  phoneVerifiedAt: new Date("2026-01-01T00:00:00.000Z")
};

test("account lifecycle actions require a verified CUSTOMER account", () => {
  assert.equal(isVerifiedCustomerAccount(verifiedCustomer, true), true);
  assert.equal(isVerifiedCustomerAccount({ ...verifiedCustomer, role: "OWNER" }, true), false);
  assert.equal(isVerifiedCustomerAccount({ ...verifiedCustomer, emailVerifiedAt: null }, false), false);
  assert.equal(isVerifiedCustomerAccount({ ...verifiedCustomer, phoneVerifiedAt: null }, true), false);
  assert.equal(isVerifiedCustomerAccount({ ...verifiedCustomer, phoneVerifiedAt: null }, false), true);
});

test("account deletion requires a current password and the exact confirmation phrase", () => {
  assert.equal(
    customerAccountDeletionSchema.safeParse({
      currentPassword: "correct horse battery staple",
      confirmation: CUSTOMER_ACCOUNT_DELETE_CONFIRMATION
    }).success,
    true
  );
  assert.equal(
    customerAccountDeletionSchema.safeParse({
      currentPassword: "correct horse battery staple",
      confirmation: "delete my account"
    }).success,
    false
  );
  assert.equal(
    customerAccountDeletionSchema.safeParse({
      currentPassword: "",
      confirmation: CUSTOMER_ACCOUNT_DELETE_CONFIRMATION
    }).success,
    false
  );
});
