-- Add optional GSTIN captured for subscription tax invoices.
ALTER TABLE "Subscription" ADD COLUMN "billingGstin" TEXT;
