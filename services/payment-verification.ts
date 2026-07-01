export type GatewayProvider = "CASHFREE";

function amountToMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

export function gatewayCurrency(provider: GatewayProvider) {
  void provider;
  const configured = process.env.CASHFREE_CURRENCY;
  return (configured?.trim() || "INR").toUpperCase();
}

export function gatewayPaymentMatches(input: {
  provider: GatewayProvider;
  expectedAmount: number;
  receivedAmount: number | null | undefined;
  receivedCurrency: string | null | undefined;
}) {
  if (input.receivedAmount === null || input.receivedAmount === undefined || !Number.isFinite(input.receivedAmount)) {
    return false;
  }

  return (
    amountToMinorUnits(input.expectedAmount) === amountToMinorUnits(input.receivedAmount) &&
    input.receivedCurrency?.trim().toUpperCase() === gatewayCurrency(input.provider)
  );
}
