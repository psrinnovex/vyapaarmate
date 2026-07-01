import { NextResponse } from "next/server";
import { cashfreeEnvironment } from "@/services/cashfree";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

function orderUrl(request: Request, publicToken: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  return `${appUrl}/order/${encodeURIComponent(publicToken)}?checkout=return`;
}

function checkoutHtml(input: {
  paymentSessionId: string;
  mode: "sandbox" | "production";
  returnUrl: string;
  orderNumber: string;
  transactionLabel: string;
}) {
  const session = JSON.stringify(input.paymentSessionId);
  const mode = JSON.stringify(input.mode);
  const returnUrl = JSON.stringify(input.returnUrl);
  const orderNumber = JSON.stringify(input.orderNumber);
  const transactionLabel = JSON.stringify(input.transactionLabel);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Cashfree Checkout</title>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
    main { width: min(92vw, 440px); border: 1px solid #e2e8f0; border-radius: 24px; background: #fff; padding: 28px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); text-align: center; }
    .spinner { width: 44px; height: 44px; margin: 0 auto 18px; border-radius: 999px; border: 4px solid #e2e8f0; border-top-color: #2563eb; animation: spin 0.8s linear infinite; }
    a { color: #2563eb; font-weight: 700; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main>
    <div class="spinner" aria-hidden="true"></div>
    <h1>Opening secure checkout</h1>
    <p><span id="transaction-label"></span> <strong id="order-number"></strong> is being sent to Cashfree.</p>
    <p id="fallback" hidden>Checkout did not open. <a id="return-link" href="#">Go back</a> and try again.</p>
  </main>
  <script>
    const paymentSessionId = ${session};
    const mode = ${mode};
    const returnUrl = ${returnUrl};
    const orderNumber = ${orderNumber};
    const transactionLabel = ${transactionLabel};
    const launchKey = "vyapaarmate:cashfree:order:" + paymentSessionId;
    let openingCheckout = false;
    let fallbackTimer = null;

    function storageSet(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        // If storage is blocked, the order page still performs server-side status checks.
      }
    }

    function storageRemove(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors and keep the fallback visible.
      }
    }

    function returnToOrder() {
      window.location.replace(returnUrl);
    }

    function showFallback() {
      document.getElementById("fallback").hidden = false;
    }

    document.getElementById("transaction-label").textContent = transactionLabel;
    document.getElementById("order-number").textContent = orderNumber;
    document.getElementById("return-link").href = returnUrl;

    async function openCheckout() {
      if (openingCheckout) return;

      openingCheckout = true;
      storageSet(launchKey, String(Date.now()));
      fallbackTimer = window.setTimeout(showFallback, 6000);

      try {
        const cashfree = Cashfree({ mode });
        await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
      } catch (error) {
        openingCheckout = false;
        storageRemove(launchKey);
        window.clearTimeout(fallbackTimer);
        console.error("Cashfree checkout failed", error);
        showFallback();
      }
    }

    window.addEventListener("pageshow", function (event) {
      if (event.persisted) {
        returnToOrder();
      }
    });

    if (window.Cashfree) openCheckout();
    else showFallback();
  </script>
</body>
</html>`;
}

export async function GET(request: Request, context: RouteContext) {
  const { publicToken } = await context.params;
  const redirectUrl = orderUrl(request, publicToken);
  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: { payment: true, business: { select: { businessType: true } } }
  });

  if (!order || !order.payment || order.payment.provider !== "CASHFREE") {
    return NextResponse.redirect(redirectUrl);
  }

  if (order.status === "CANCELLED") {
    return NextResponse.redirect(redirectUrl);
  }

  if (order.payment.status === "COMPLETED" || order.paymentStatus === "COMPLETED") {
    return NextResponse.redirect(redirectUrl);
  }

  if (order.payment.status !== "PENDING" || order.paymentStatus !== "PENDING") {
    return NextResponse.redirect(redirectUrl);
  }

  if (!order.payment.cashfreePaymentSessionId || !order.payment.paymentRequestExpiresAt || order.payment.paymentRequestExpiresAt.getTime() <= Date.now()) {
    return NextResponse.redirect(redirectUrl);
  }

  return new Response(
    checkoutHtml({
      paymentSessionId: order.payment.cashfreePaymentSessionId,
      mode: cashfreeEnvironment(),
      returnUrl: redirectUrl,
      orderNumber: order.orderNumber,
      transactionLabel: getBusinessConsoleCopy(order.business.businessType).transactionSingular
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
