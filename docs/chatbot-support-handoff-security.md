# Chatbot Support Handoff Security

Date: 2026-07-03

## Handoff Rule

The AI/rules bot may recommend support handoff, but it cannot choose an agent or execute assignment. Server-side queue logic decides assignment in `lib/support-agent-queue.ts`.

## Assignment Sources

Assignment audit records use:

- `source: chatbot` for chatbot-created tickets entering server assignment
- `source: manual` for support-agent/manual claim flows
- `source: admin` for super-admin actions
- `source: system` for queue rotation and automatic reassignment

Each assignment audit event records ticket ID, code, business ID, assigned agent ID, assigned by, reason, timestamp, and source.

## Access Rules

- Customers can access a live chat only by matching session ticket, requester user, or owned business support context.
- Support agents see assigned tickets and authorized open unassigned queue tickets, not tickets assigned to other agents.
- Super admins use `/admin/support` with existing admin authorization.
- Owners/customers do not see internal agent metadata.
- Support-agent contact fields are masked outside super-admin payloads.

## Transcript Rules

Chatbot/support ticket messages are stored redacted by default. Raw storage requires `CHATBOT_STORE_RAW_MESSAGES=true` and a retention/privacy review. Ticket fields may keep minimal handoff identifiers such as ticket code, business ID, order reference, payment reference, and contact fields only where needed for support.

## Abuse Protection

- Public chatbot: per-IP and per-session rate limits.
- Authenticated chatbot: per-user/session rate limits.
- Handoff: stricter per-user/session/IP limits.
- Ticket chat: per-ticket sender rate limits.
- Message length and request body limits are enforced before processing.

## Safe Customer UX

The widget shows ticket code, queue position, and assigned agent display name. It does not expose internal notes, admin metadata, agent email/phone, raw audit logs, or assignment internals.

## Manual Checks

- Confirm support-agent alert flow still opens the exact ticket.
- Confirm a support agent cannot fetch a ticket assigned to another agent.
- Confirm super admin can override assignment and the audit event is written.
- Confirm WhatsApp inbound tenant routing maps to the correct business before any future support-chat bridge is enabled.
