import assert from "node:assert/strict";
import test from "node:test";
import { generateSupportReply, resolveSupportPortal, sanitizeSupportPath } from "@/lib/support-chatbot";
import { extractSupportTicketDetails, formatSupportTicketChatReply } from "@/lib/support-tickets";

test("sanitizes chatbot paths to internal pathnames only", () => {
  assert.equal(sanitizeSupportPath("/user/bookings?tab=paid#top"), "/user/bookings");
  assert.equal(sanitizeSupportPath("https://example.com/admin"), null);
  assert.equal(sanitizeSupportPath("//admin/payments"), null);
});

test("resolves protected portal modes from verified session roles", () => {
  assert.equal(resolveSupportPortal("/admin/payments", null), "public");
  assert.equal(resolveSupportPortal("/dashboard/payments", null), "public");
  assert.equal(resolveSupportPortal("/admin/payments", "OWNER"), "public");
  assert.equal(resolveSupportPortal("/features", "SUPER_ADMIN"), "public");
  assert.equal(resolveSupportPortal("/admin/payments", "SUPER_ADMIN"), "admin");
  assert.equal(resolveSupportPortal("/support", "SUPPORT_AGENT"), "support");
  assert.equal(resolveSupportPortal("/admin/support", "SUPPORT_AGENT"), "support");
  assert.equal(resolveSupportPortal("/admin/payments", "SUPPORT_AGENT"), "public");
  assert.equal(resolveSupportPortal("/dashboard/orders", "OWNER"), "business");
  assert.equal(resolveSupportPortal("/user/bookings", "CUSTOMER"), "customer");
});

test("customer user portal gives customer-safe booking guidance", () => {
  const reply = generateSupportReply({
    message: "payment pending",
    path: "/user/bookings",
    sessionRole: "CUSTOMER"
  });

  assert.equal(reply.portal, "customer");
  assert.equal(reply.intent, "payments");
  assert.equal(reply.escalate, true);
  assert.match(reply.reply, /User Portal Bookings/i);
  assert.equal(reply.actions[0]?.href, "/user/bookings");
});

test("payment issues stay on payment workflow instead of generic handoff", () => {
  const reply = generateSupportReply({
    message: "my payment failed issue please help",
    path: "/dashboard/payments",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "payments");
  assert.equal(reply.escalate, true);
  assert.equal(reply.actions[0]?.href, "/dashboard/payments");
});

test("support intake details acknowledge instead of repeating the handoff prompt", () => {
  const reply = generateSupportReply({
    message: "issue: payments, business name: pshr saloon & spa",
    path: "/dashboard",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "handoff");
  assert.equal(reply.escalate, true);
  assert.match(reply.reply, /right support details/i);
  assert.doesNotMatch(reply.reply, /Send issue/i);
  assert.equal(reply.actions[0]?.href, "/contact");
  assert.equal(reply.actions[1]?.href, "mailto:support@pshrinnovex.com");
});

test("support ticket extraction reads safe handoff identifiers", () => {
  const details = extractSupportTicketDetails("issue: payment pending, business name: pshr saloon & spa, phone: 9876543210, order id: ORD-22, utr: UPI123456");

  assert.equal(details.issue, "payment pending");
  assert.equal(details.requesterBusinessName, "pshr saloon & spa");
  assert.equal(details.requesterPhone, "9876543210");
  assert.equal(details.orderReference, "ORD-22");
  assert.equal(details.paymentReference, "UPI123456");
});

test("ticket-backed chatbot replies include the support ticket code", () => {
  const reply = formatSupportTicketChatReply("I can route this to support. Send issue, business name, phone, and order ID if any.", {
    id: "ticket_1",
    code: "SUP-260624-ABC123",
    status: "OPEN",
    priority: "MEDIUM",
    assignedToName: null,
    queuePosition: 1,
    created: true,
    intakeComplete: false
  });

  assert.match(reply, /SUP-260624-ABC123/);
  assert.ok(reply.split(/\s+/).length <= 34);
});

test("business menu questions route to menu controls", () => {
  const reply = generateSupportReply({
    message: "how to add item and change item price",
    path: "/dashboard/menu",
    sessionRole: "MANAGER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "menu");
  assert.match(reply.reply, /Open Menu/i);
  assert.equal(reply.actions[0]?.href, "/dashboard/menu");
});

test("business capability questions are not mistaken for current settings page", () => {
  const reply = generateSupportReply({
    message: "what can i do",
    path: "/dashboard/settings",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "features");
  assert.match(reply.reply, /manage orders, catalog, payments/i);
  assert.equal(reply.actions[0]?.href, "/dashboard/orders");
  assert.notEqual(reply.actions[0]?.href, "/dashboard/settings");
});

test("business correction messages ask for clarification instead of repeating path guidance", () => {
  const reply = generateSupportReply({
    message: "i dont want this",
    path: "/dashboard/settings",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "fallback");
  assert.match(reply.reply, /what you want instead/i);
  assert.doesNotMatch(reply.reply, /Open Settings/i);
  assert.equal(reply.actions[0]?.href, "/dashboard/orders");
});

test("explicit current-page help can still use the current dashboard path", () => {
  const reply = generateSupportReply({
    message: "what can i do here",
    path: "/dashboard/settings",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "settings");
  assert.match(reply.reply, /Open Settings/i);
  assert.equal(reply.actions[0]?.href, "/dashboard/settings");
});

test("unknown business questions admit missing knowledge instead of guessing from page", () => {
  const reply = generateSupportReply({
    message: "blue umbrella mango text",
    path: "/dashboard/settings",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "fallback");
  assert.match(reply.reply, /I don't know enough yet/i);
  assert.doesNotMatch(reply.reply, /Open Settings/i);
});

test("off-topic questions are rejected as unknown", () => {
  const reply = generateSupportReply({
    message: "what is the cricket score today",
    path: "/dashboard/orders",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "fallback");
  assert.match(reply.reply, /I don't know that/i);
  assert.doesNotMatch(reply.reply, /Open Orders/i);
});

test("expanded payment dataset handles paid but pending wording", () => {
  const reply = generateSupportReply({
    message: "customer paid but pending after manual upi transaction id",
    path: "/dashboard",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "payments");
  assert.equal(reply.escalate, true);
  assert.equal(reply.actions[0]?.href, "/dashboard/payments");
});

test("expanded refund dataset handles double debit wording", () => {
  const reply = generateSupportReply({
    message: "customer paid twice and was debited twice for booking",
    path: "/user/bookings",
    sessionRole: "CUSTOMER"
  });

  assert.equal(reply.portal, "customer");
  assert.equal(reply.intent, "refund");
  assert.equal(reply.escalate, true);
  assert.match(reply.reply, /Refunds need manual review/i);
});

test("expanded reports dataset handles daily closing wording", () => {
  const reply = generateSupportReply({
    message: "daily sales closing report with top items",
    path: "/dashboard",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "reports");
  assert.equal(reply.actions[0]?.href, "/dashboard/reports");
});

test("expanded account dataset escalates dashboard access trouble", () => {
  const reply = generateSupportReply({
    message: "forgot password and cannot access dashboard",
    path: "/dashboard",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "account");
  assert.equal(reply.escalate, true);
  assert.equal(reply.actions[0]?.href, "/dashboard/settings");
});

test("business customer questions route to CRM controls", () => {
  const reply = generateSupportReply({
    message: "where can I see repeat customer history and opt in",
    path: "/dashboard/customers",
    sessionRole: "OWNER"
  });

  assert.equal(reply.portal, "business");
  assert.equal(reply.intent, "customers");
  assert.match(reply.reply, /Open Customers/i);
  assert.equal(reply.actions[0]?.href, "/dashboard/customers");
});

test("admin payout settlement questions route to admin payments", () => {
  const reply = generateSupportReply({
    message: "payout settlement missing for wallet credit",
    path: "/admin/payments",
    sessionRole: "SUPER_ADMIN"
  });

  assert.equal(reply.portal, "admin");
  assert.equal(reply.intent, "payouts");
  assert.equal(reply.escalate, true);
  assert.equal(reply.actions[0]?.href, "/admin/payments");
});

test("support portal questions stay on support links", () => {
  const reply = generateSupportReply({
    message: "payout settlement missing for wallet credit",
    path: "/support",
    sessionRole: "SUPPORT_AGENT"
  });

  assert.equal(reply.portal, "support");
  assert.equal(reply.intent, "payouts");
  assert.equal(reply.actions[0]?.href, "/support");
  assert.notEqual(reply.actions[0]?.href, "/admin/payments");
});

test("fake admin path without admin session does not return admin actions", () => {
  const reply = generateSupportReply({
    message: "payout settlement missing",
    path: "/admin/payments",
    sessionRole: null
  });

  assert.equal(reply.portal, "public");
  assert.notEqual(reply.actions[0]?.href, "/admin/payments");
});
