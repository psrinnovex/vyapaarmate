-- Speed up public listing and owner dashboard read paths.
CREATE INDEX "Business_isActive_isVerified_isOpen_name_idx"
  ON "Business"("isActive", "isVerified", "isOpen", "name");

CREATE INDEX "MenuItem_businessId_isBestSeller_updatedAt_idx"
  ON "MenuItem"("businessId", "isBestSeller", "updatedAt");

CREATE INDEX "Customer_businessId_lastOrderAt_createdAt_idx"
  ON "Customer"("businessId", "lastOrderAt", "createdAt");

CREATE INDEX "Customer_businessId_totalOrders_idx"
  ON "Customer"("businessId", "totalOrders");

CREATE INDEX "Order_businessId_createdAt_idx"
  ON "Order"("businessId", "createdAt");

CREATE INDEX "Payment_businessId_createdAt_idx"
  ON "Payment"("businessId", "createdAt");

CREATE INDEX "Payment_businessId_status_createdAt_idx"
  ON "Payment"("businessId", "status", "createdAt");

CREATE INDEX "BusinessWalletEntry_businessId_type_status_idx"
  ON "BusinessWalletEntry"("businessId", "type", "status");

CREATE INDEX "Subscription_businessId_createdAt_idx"
  ON "Subscription"("businessId", "createdAt");
