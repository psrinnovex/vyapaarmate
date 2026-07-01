-- A single Razorpay payment can settle only one platform payment record.
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");
