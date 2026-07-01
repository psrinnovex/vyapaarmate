# Cashfree Payment Setup

VyapaarMate supports Cashfree as the primary payment gateway for customer orders and business subscription checkouts through Cashfree Orders and hosted checkout.

## What This Integration Does

1. Customer places an order on a business page, or a business owner starts subscription checkout from billing.
2. The server creates a Cashfree order.
3. The payer opens Cashfree hosted checkout from the order page or subscription payment page.
4. Cashfree sends a signed webhook to `/api/webhooks/cashfree`.
5. VyapaarMate marks the payment as completed only after proving the successful payment id, exact amount, and INR currency.
6. The public order page and dashboard subscription payment page also poll Cashfree order status as a backup if the webhook is delayed.

Customer order payments and platform subscription payments use Cashfree checkout. A saved PSHR Innovex UPI ID in admin settings does not override the gateway flow.

## Required Environment Variables

Use sandbox first:

```bash
PAYMENT_RECEIVER_NAME="PSHR INNOVEX PRIVATE LIMITED"
CASHFREE_ENV=sandbox
CASHFREE_APP_ID=your_cashfree_app_id
CASHFREE_SECRET_KEY=your_cashfree_secret_key
CASHFREE_CURRENCY=INR
CASHFREE_SPLIT_ENABLED=false
PAYMENT_CHECKOUT_EXPIRES_MINUTES=30
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

Switch `CASHFREE_ENV=production` only after production credentials and KYC are active.

Cashfree Payouts uses separate product credentials:

```bash
CASHFREE_PAYOUTS_ENV=sandbox
CASHFREE_PAYOUTS_CLIENT_ID=your_cashfree_payout_client_id
CASHFREE_PAYOUTS_CLIENT_SECRET=your_cashfree_payout_client_secret
CASHFREE_PAYOUTS_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
CASHFREE_PAYOUTS_AUTO_ENABLED=true
CASHFREE_PAYOUTS_MIN_AMOUNT=1
CASHFREE_PAYOUTS_BANK_TRANSFER_MODE=banktransfer
CASHFREE_PAYOUTS_WEBHOOK_SECRET=your_cashfree_payout_webhook_secret
```

## Cashfree Dashboard Setup

Configure this webhook URL in Cashfree:

```text
https://your-domain.com/api/webhooks/cashfree
```

Enable payment success and payment failure webhook events.

Configure this Cashfree Payouts webhook URL separately:

```text
https://your-domain.com/api/webhooks/cashfree-payouts
```

Enable transfer success, failure, reversed, and acknowledged events.

For live Payouts API calls, Cashfree requires either IP whitelisting or an `x-cf-signature` header. If the app runs on Vercel/serverless without a fixed outbound IP, download the Cashfree Payouts public key and set `CASHFREE_PAYOUTS_PUBLIC_KEY`; the app will generate `x-cf-signature` automatically.

## Business Settlement Options

### Platform Wallet Mode

Keep:

```bash
CASHFREE_SPLIT_ENABLED=false
```

Customer payments settle to the PSHR Innovex Cashfree merchant account. VyapaarMate credits the business wallet after successful payment, releases it after provider settlement delay, and automatically sends eligible balances through Cashfree Payouts when auto-payouts are enabled.

The automatic payout sequence is:

1. Wallet credit becomes `AVAILABLE`.
2. The scheduled job creates a `BusinessPayout` and moves linked wallet credits to `PROCESSING_PAYOUT`.
3. Cashfree receives a deterministic transfer id for idempotency.
4. Webhook or reconciliation marks success as `PAID` and wallet credits as `SETTLED`; failure releases the credits back to `AVAILABLE`.

Do not enable Easy Split for the normal platform-wallet model. Cashfree vendor IDs are no longer required for businesses to accept online payment.

## Deployment Checklist

1. Add Cashfree env variables in Vercel.
2. Run database migrations:

```bash
npm run db:deploy
```

3. Deploy the app.
4. Place one sandbox test order.
5. Start one sandbox subscription checkout from `/dashboard/billing`.
6. Confirm:
   - Cashfree checkout opens.
   - No PSHR Innovex manual UPI QR is shown for customer order payment.
   - Payment returns to the order page.
   - `/api/webhooks/cashfree` receives the event.
   - `Payment.status` becomes `COMPLETED`.
   - `Order.paymentStatus` becomes `COMPLETED`.
   - `Subscription.paymentStatus` becomes `COMPLETED` after a subscription payment.
   - a business wallet credit is created.
   - a settled wallet balance moves to payout processing and then paid after the Cashfree Payouts sandbox transfer succeeds.

Official docs:
- Cashfree Create Order API: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
- Cashfree Web Checkout: https://www.cashfree.com/docs/payments/online/web/cashfree-checkout
- Cashfree Webhooks: https://www.cashfree.com/docs/payments/online/webhooks/overview
- Cashfree Payouts V2 Transfers: https://www.cashfree.com/docs/api-reference/payouts/v2/transfers-v2/standard-transfer-v2
