# Customer Payments and Business Wallet Payouts

VyapaarMate now uses PSHR Innovex as the platform payment receiver for online customer payments. Businesses do not need to configure their own UPI ID or Cashfree vendor before accepting online payment.

Customer order payments use Cashfree hosted checkout. A PSHR Innovex UPI ID saved in admin settings is not used for customer checkout.

## Production Flow

1. Customer pays through Cashfree checkout on the order page.
2. The provider sends a signed webhook to VyapaarMate.
3. VyapaarMate verifies the provider payment id, exact amount, and INR currency.
4. The order is marked `COMPLETED` and one `BusinessWalletEntry` is created in the same database transaction.
5. The wallet credit starts as `PENDING_PROVIDER_SETTLEMENT`.
6. `/api/jobs/payment-transfers` reconciles completed payments and releases eligible wallet credits to `AVAILABLE` after `PAYMENT_PROVIDER_SETTLEMENT_DAYS`.
7. If Cashfree Payouts is configured and `CASHFREE_PAYOUTS_AUTO_ENABLED=true`, the job creates a `BusinessPayout`, locks the wallet credits as `PROCESSING_PAYOUT`, and sends the amount to the saved business UPI/bank destination.
8. Cashfree payout webhooks or the reconciliation job mark successful payouts `PAID`, create the payout debit ledger entry, and mark the wallet credits `SETTLED`.
9. Admin manual payout recording remains available from `/admin/payments` only for balances that are still `AVAILABLE`.

## Required Gateway Setup

Configure Cashfree as the platform gateway:

```bash
PAYMENT_RECEIVER_NAME="PSHR INNOVEX PRIVATE LIMITED"
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your-cashfree-app-id
CASHFREE_SECRET_KEY=your-cashfree-secret
CASHFREE_CURRENCY=INR
CASHFREE_SPLIT_ENABLED=false
PAYMENT_CHECKOUT_EXPIRES_MINUTES=30
PAYMENT_PROVIDER_SETTLEMENT_DAYS=2
CASHFREE_PAYOUTS_ENV=sandbox
CASHFREE_PAYOUTS_CLIENT_ID=your-cashfree-payout-client-id
CASHFREE_PAYOUTS_CLIENT_SECRET=your-cashfree-payout-client-secret
CASHFREE_PAYOUTS_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
CASHFREE_PAYOUTS_AUTO_ENABLED=true
CASHFREE_PAYOUTS_MIN_AMOUNT=1
CASHFREE_PAYOUTS_BANK_TRANSFER_MODE=banktransfer
CASHFREE_PAYOUTS_WEBHOOK_SECRET=your-cashfree-payout-webhook-secret
```

Keep `CASHFREE_SPLIT_ENABLED=false` for this platform-wallet model.

## Admin Operations

- Set the per-business platform fee from `/admin/businesses` -> Payout setup.
- Monitor wallet gross, platform fees, provider-pending, ready, Cashfree-processing, and paid-out totals from `/admin/payments`.
- Record a payout manually only when Cashfree automatic payout is disabled or the balance was paid outside Cashfree.
- Use the payout reference field for bank UTR, provider payout id, or manual settlement note.

## Deployment Checklist

1. Deploy the Prisma migration `20260614193000_add_business_wallet_ledger`.
2. Configure platform gateway credentials and webhooks.
3. Configure `CRON_SECRET`.
4. Run `npm run db:deploy`.
5. Place a low-value test order and confirm:
   - `Payment.status` becomes `COMPLETED`.
   - A `BusinessWalletEntry` is created for the payment.
   - The wallet credit moves from provider-pending to available after the configured delay or by running the protected reconciliation endpoint.
   - With auto-payout enabled, available credits move to `PROCESSING_PAYOUT`, then `SETTLED` after Cashfree confirms success.
   - Cashfree Payouts webhook callback is configured as `https://your-domain.com/api/webhooks/cashfree-payouts`.
   - Admin can still record a manual payout from `/admin/payments` for balances not already processing.

This implementation is operational accounting, not legal advice. Before production payouts, confirm PSHR Innovex's merchant-of-record, GST/TDS, refund, cancellation, and settlement process with the payment provider and finance/legal advisors.
