UPDATE "Subscription"
SET "paymentStatus" = 'COMPLETED'
WHERE "status" = 'ACTIVE'
  AND "paymentStatus" = 'PENDING';
