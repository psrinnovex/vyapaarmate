import { NextResponse } from "next/server";
import { requireBusinessSession } from "@/lib/api-session";
import { prisma } from "@/lib/prisma";
import { cashfreeEnvironment } from "@/services/cashfree";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ subscriptionId: string }>;
};

function appUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}

function paymentUrl(request: Request, subscriptionId: string) {
  return `${appUrl(request)}/dashboard/billing/payment/${encodeURIComponent(subscriptionId)}?checkout=return`;
}

function checkoutHtml(input: {
  paymentSessionId: string;
  mode: "sandbox" | "production";
  returnUrl: string;
  reference: string;
}) {
  const session = JSON.stringify(input.paymentSessionId);
  const mode = JSON.stringify(input.mode);
  const returnUrl = JSON.stringify(input.returnUrl);
  const reference = JSON.stringify(input.reference);

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
    .spinner { width: 44px; height: 44px; margin: 0 auto 18px; border-radius: 999px; border: 4px solid #e2e8f0; border-top-color: #059669; animation: spin 0.8s linear infinite; }
    a { color: #059669; font-weight: 700; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main>
    <div class="spinner" aria-hidden="true"></div>
    <h1>Opening secure checkout</h1>
    <p>Subscription <strong id="reference"></strong> is being sent to Cashfree.</p>
    <p id="fallback" hidden>Checkout did not open. <a id="return-link" href="#">Go back to billing</a> and try again.</p>
  </main>
  <script>
    const paymentSessionId = ${session};
    const mode = ${mode};
    const returnUrl = ${returnUrl};
    const reference = ${reference};
    const launchKey = "vyapaarmate:cashfree:subscription:" + paymentSessionId;
    let openingCheckout = false;
    let fallbackTimer = null;

    function storageSet(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        // If storage is blocked, the payment page still performs server-side status checks.
      }
    }

    function storageRemove(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Ignore storage errors and keep the fallback visible.
      }
    }

    function returnToPayment() {
      window.location.replace(returnUrl);
    }

    function showFallback() {
      document.getElementById("fallback").hidden = false;
    }

    document.getElementById("reference").textContent = reference;
    document.getElementById("return-link").href = returnUrl;

    async function openCheckout() {
      if (openingCheckout) return;

      openingCheckout = true;
      storageSet(launchKey, "opened");
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
        returnToPayment();
      }
    });

    if (window.Cashfree) openCheckout();
    else showFallback();
  </script>
</body>
</html>`;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireBusinessSession("business:billing:write");
  if (auth.response) {
    return NextResponse.redirect(`${appUrl(request)}/login`);
  }
  const { session } = auth;

  const { subscriptionId } = await context.params;
  const redirectUrl = paymentUrl(request, subscriptionId);
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, businessId: session.businessId },
    select: {
      id: true,
      invoiceNumber: true,
      paymentProvider: true,
      paymentStatus: true,
      cashfreePaymentSessionId: true,
      paymentRequestExpiresAt: true
    }
  });

  if (!subscription || subscription.paymentProvider !== "CASHFREE") {
    return NextResponse.redirect(redirectUrl);
  }

  if (subscription.paymentStatus === "COMPLETED") {
    return NextResponse.redirect(redirectUrl);
  }

  if (
    !subscription.cashfreePaymentSessionId ||
    !subscription.paymentRequestExpiresAt ||
    subscription.paymentRequestExpiresAt.getTime() <= Date.now()
  ) {
    return NextResponse.redirect(redirectUrl);
  }

  return new Response(
    checkoutHtml({
      paymentSessionId: subscription.cashfreePaymentSessionId,
      mode: cashfreeEnvironment(),
      returnUrl: redirectUrl,
      reference: subscription.invoiceNumber ?? `SUB-${subscription.id.slice(-8).toUpperCase()}`
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
