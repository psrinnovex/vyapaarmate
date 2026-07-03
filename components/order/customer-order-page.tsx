"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Banknote, CheckCircle2, ChevronLeft, Clock3, ExternalLink, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Minus, Plus, ReceiptText, Search, ShieldCheck, Sparkles, TicketPercent, Trash2, Wallet, X } from "lucide-react";
import { BusinessHoursDisclosure } from "@/components/businesses/business-hours-disclosure";
import type { CustomerBookingProfile } from "@/lib/booking-profile";
import { customerProfileIsBookingVerified } from "@/lib/booking-profile";
import { isBusinessOpenAt } from "@/lib/business-hours";
import {
  calculateDistanceKm,
  fulfillmentFeeForOrder,
  fulfillmentLabelForBusinessType,
  fulfillmentSummaryForBusinessType,
  type ActiveFulfillmentMode
} from "@/lib/business-rules";
import { getBusinessConsoleCopy, type BusinessConsoleCopy } from "@/lib/business-console-copy";
import { fulfillmentModeIcons, getBusinessConsoleIcons } from "@/lib/business-console-icons";
import type { DemoBusiness, DemoMenuItem } from "@/lib/demo-data";
import { categoriesForBusiness } from "@/lib/demo-data";
import { cn, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { EmailInput, PhoneInput } from "@/components/ui/form-fields";
import { PaginationControls, usePaginatedItems } from "@/components/ui/pagination";
import { LazyLottieAnimation } from "@/components/ui/lottie-animation";
import { CustomerLocationMapPicker } from "@/components/order/customer-location-map-picker";
import { orderAnimationPaths } from "@/lib/order-animations";

type CartLine = DemoMenuItem & { quantity: number };
type CustomerLocation = { latitude: number; longitude: number };
type OrderBillingBreakdown = {
  subtotal: number;
  serviceFee: number;
  discount: number;
  taxableAmount: number;
  gstRateBps: number;
  gstAmount: number;
  total: number;
};
type AppliedCoupon = {
  id: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  maxDiscountAmount: number | null;
  minimumOrderAmount: number;
};
type CouponPreviewResult =
  | { ok: true; coupon: AppliedCoupon; breakdown: OrderBillingBreakdown }
  | { ok: false; error: string };
type StoredCartSnapshot = {
  items?: Record<string, unknown>;
  couponCode?: unknown;
};
type ConfirmedOrder = {
  orderNumber: string;
  orderUrl: string | null;
  invoiceUrl: string | null;
  paymentUrl: string | null;
  paymentQrImageUrl: string | null;
  paymentQrExpiresAt: string | null;
  whatsappNotificationSent: boolean;
  message: string | null;
};
type OrderSubmissionResponse = {
  orderNumber?: unknown;
  orderUrl?: unknown;
  invoiceUrl?: unknown;
  paymentUrl?: unknown;
  paymentQrImageUrl?: unknown;
  paymentQrExpiresAt?: unknown;
  whatsappNotificationSent?: unknown;
  message?: unknown;
  error?: unknown;
};
const PickupFulfillmentIcon = fulfillmentModeIcons.PICKUP;
const DineInFulfillmentIcon = fulfillmentModeIcons.DINE_IN;
const ServiceAtLocationFulfillmentIcon = fulfillmentModeIcons.SERVICE_AT_LOCATION;

function money(value: number) {
  return Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
}

function normalizeCouponInput(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function clearSelectionLabel(copy: BusinessConsoleCopy) {
  return copy.transactionSingular === "Order" ? "Clear cart" : "Clear";
}

const clearSelectionButtonClass = "h-8 px-2.5 text-xs border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100";
const publicMenuPageSize = 28;

function gstRateLabel(rateBps: number) {
  return `${(rateBps / 100).toFixed(2)}%`;
}

function calculateClientDiscount(amount: number, coupon: AppliedCoupon | null | undefined) {
  const base = money(amount);
  if (!coupon || base <= 0) return 0;

  const discountValue = Math.max(0, Number(coupon.discountValue));
  const rawDiscount =
    coupon.discountType === "PERCENTAGE"
      ? (base * Math.min(100, discountValue)) / 100
      : discountValue;
  const cap = coupon.maxDiscountAmount === null ? rawDiscount : Math.max(0, Number(coupon.maxDiscountAmount));

  return money(Math.min(base, rawDiscount, cap));
}

function buildClientOrderBreakdown(input: {
  subtotal: number;
  serviceFee: number;
  coupon?: AppliedCoupon | null;
  gstRateBps?: number;
}): OrderBillingBreakdown {
  const subtotal = money(input.subtotal);
  const serviceFee = subtotal > 0 ? money(input.serviceFee) : 0;
  const discount = calculateClientDiscount(subtotal, input.coupon);
  const taxableAmount = money(subtotal - discount + serviceFee);
  const gstRateBps = Math.max(0, Math.min(10000, Math.round(input.gstRateBps ?? 0)));
  const gstAmount = money((taxableAmount * gstRateBps) / 10000);

  return {
    subtotal,
    serviceFee,
    discount,
    taxableAmount,
    gstRateBps,
    gstAmount,
    total: money(taxableAmount + gstAmount)
  };
}

function couponPreviewError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return "This coupon could not be applied.";
}

function parseCouponPreviewPayload(payload: unknown): CouponPreviewResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "This coupon could not be applied." };
  }

  const coupon = "coupon" in payload ? payload.coupon : null;
  const breakdown = "breakdown" in payload ? payload.breakdown : null;
  if (!coupon || typeof coupon !== "object" || !breakdown || typeof breakdown !== "object") {
    return { ok: false, error: "This coupon could not be applied." };
  }

  const parsedCoupon = {
    id: "id" in coupon && typeof coupon.id === "string" ? coupon.id : "",
    description: "description" in coupon && typeof coupon.description === "string" ? coupon.description : null,
    discountType: "discountType" in coupon && coupon.discountType === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE",
    discountValue: Number("discountValue" in coupon ? coupon.discountValue : 0),
    maxDiscountAmount: "maxDiscountAmount" in coupon && coupon.maxDiscountAmount !== null ? Number(coupon.maxDiscountAmount) : null,
    minimumOrderAmount: Number("minimumOrderAmount" in coupon ? coupon.minimumOrderAmount : 0)
  } satisfies AppliedCoupon;
  const parsedBreakdown = {
    subtotal: Number("subtotal" in breakdown ? breakdown.subtotal : 0),
    serviceFee: Number("serviceFee" in breakdown ? breakdown.serviceFee : 0),
    discount: Number("discount" in breakdown ? breakdown.discount : 0),
    taxableAmount: Number("taxableAmount" in breakdown ? breakdown.taxableAmount : 0),
    gstRateBps: Number("gstRateBps" in breakdown ? breakdown.gstRateBps : 0),
    gstAmount: Number("gstAmount" in breakdown ? breakdown.gstAmount : 0),
    total: Number("total" in breakdown ? breakdown.total : 0)
  } satisfies OrderBillingBreakdown;

  if (
    !parsedCoupon.id ||
    !Number.isFinite(parsedCoupon.discountValue) ||
    !Number.isFinite(parsedCoupon.minimumOrderAmount) ||
    Object.values(parsedBreakdown).some((value) => !Number.isFinite(value))
  ) {
    return { ok: false, error: "This coupon could not be applied." };
  }

  return { ok: true, coupon: parsedCoupon, breakdown: parsedBreakdown };
}

async function fetchCouponPreview(input: {
  businessSlug: string;
  couponCode: string;
  subtotal: number;
  serviceFee: number;
  orderType: ActiveFulfillmentMode;
}): Promise<CouponPreviewResult> {
  const response = await fetch("/api/orders/coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, error: couponPreviewError(payload) };
  }

  return parseCouponPreviewPayload(payload);
}

function FulfillmentModeIcon({ mode }: { mode: ActiveFulfillmentMode }) {
  if (mode === "DINE_IN") return <DineInFulfillmentIcon className="size-4" />;
  if (mode === "SERVICE_AT_LOCATION") return <ServiceAtLocationFulfillmentIcon className="size-4" />;
  return <PickupFulfillmentIcon className="size-4" />;
}

function bookingProfileNotice(profile: CustomerBookingProfile, copy: BusinessConsoleCopy) {
  if (profile.status === "verified") return null;
  if (profile.status === "guest") {
    return `Sign in with a verified user profile before placing ${copy.transactionPlural.toLowerCase()}.`;
  }
  if (profile.status === "wrong_role") {
    return `Business and admin accounts cannot place ${copy.transactionPlural.toLowerCase()}. Sign in with a verified user account.`;
  }
  return `Complete user profile verification before placing ${copy.transactionPlural.toLowerCase()}.`;
}

function bookingProfileAction(profile: CustomerBookingProfile) {
  if (profile.status === "guest") return { href: profile.loginHref, label: "Sign in" };
  if (profile.status === "unverified") {
    return { href: profile.profileHref, label: "Open profile" };
  }
  return null;
}

export function CustomerOrderPage({
  business,
  bookingProfile
}: {
  business: DemoBusiness;
  bookingProfile: CustomerBookingProfile;
}) {
  const copy = getBusinessConsoleCopy(business.businessType);
  const icons = getBusinessConsoleIcons(business.businessType);
  const transactionLower = copy.transactionSingular.toLowerCase();
  const transactionPluralLower = copy.transactionPlural.toLowerCase();
  const selectionTitle = copy.transactionSingular === "Order" ? "Cart" : `Selected ${copy.itemPlural}`;
  const selectionClearLabel = clearSelectionLabel(copy);
  const BusinessIcon = icons.businessIcon;
  const CategoryIcon = icons.categoryIcon;
  const ItemIcon = icons.itemIcon;
  const TransactionIcon = icons.transactionIcon;
  const categories = categoriesForBusiness(business);
  const heroImageUrl = business.logoUrl || business.menu.find((item) => item.imageUrl)?.imageUrl || null;
  const heroImageIsSvg = heroImageUrl?.toLowerCase().split("?")[0].endsWith(".svg") ?? false;
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"selection" | "billing">("selection");
  const fulfillmentModes = business.fulfillmentModes.length ? business.fulfillmentModes : (["PICKUP"] as ActiveFulfillmentMode[]);
  const [orderType, setOrderType] = useState<ActiveFulfillmentMode>(fulfillmentModes[0]);
  const onlinePaymentAvailable = business.onlinePaymentAvailable;
  const cashPaymentAvailable = business.allowsPayOnDelivery;
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "PAY_ON_PICKUP_OR_DELIVERY">(
    onlinePaymentAvailable ? "UPI" : "PAY_ON_PICKUP_OR_DELIVERY"
  );
  const whatsappFlowAvailable = business.whatsappAvailable;
  const [whatsappOptIn, setWhatsappOptIn] = useState(whatsappFlowAvailable);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [serviceAddress, setServiceAddress] = useState("");
  const [now, setNow] = useState(() => new Date());
  const cartStorageKey = `vyapaarmate:public-cart:${business.slug}:v2`;
  const [cartHydrated, setCartHydrated] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponNotice, setCouponNotice] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [descriptionModalItem, setDescriptionModalItem] = useState<DemoMenuItem | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(cartStorageKey);
        if (!raw) return;

        const parsed = JSON.parse(raw) as StoredCartSnapshot | Record<string, unknown>;
        const storedItems =
          parsed && typeof parsed === "object" && "items" in parsed && parsed.items && typeof parsed.items === "object"
            ? parsed.items
            : parsed;
        const menuById = new Map(business.menu.map((item) => [item.id, item]));
        const nextCart: Record<string, CartLine> = {};

        Object.entries(storedItems ?? {}).forEach(([itemId, quantityValue]) => {
          const menuItem = menuById.get(itemId);
          const quantity = Math.max(0, Math.min(99, Math.floor(Number(quantityValue))));
          if (!menuItem || !menuItem.isAvailable || quantity < 1) return;
          nextCart[itemId] = { ...menuItem, quantity };
        });

        const restoredCouponCode =
          parsed && typeof parsed === "object" && "couponCode" in parsed && typeof parsed.couponCode === "string"
            ? normalizeCouponInput(parsed.couponCode)
            : "";

        if (cancelled) return;
        setCart(nextCart);
        setAppliedCouponCode(Object.keys(nextCart).length && restoredCouponCode ? restoredCouponCode : null);
      } catch {
        window.localStorage.removeItem(cartStorageKey);
      } finally {
        if (!cancelled) setCartHydrated(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [business.menu, cartStorageKey]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    return business.menu.filter((item) => {
      const categoryMatch = item.category === activeCategory;
      const searchMatch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, business.menu, search]);
  const menuPagination = usePaginatedItems(filteredItems, {
    pageSize: publicMenuPageSize,
    resetKey: `${activeCategory}-${search}-${filteredItems.length}-${filteredItems[0]?.id ?? "empty"}-${filteredItems.at(-1)?.id ?? "empty"}`
  });

  const cartLines = Object.values(cart);
  const cartItemCount = cartLines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartLines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const serviceFee = fulfillmentFeeForOrder({
    fee: business.deliveryFee,
    orderType,
    fulfillmentModes,
    hasItems: cartLines.length > 0
  });
  const billing = buildClientOrderBreakdown({
    subtotal,
    serviceFee,
    coupon: appliedCoupon,
    gstRateBps: business.orderGstRateBps
  });
  const selectedTotal = money(subtotal);
  const statusTotalLabel = checkoutStep === "billing" ? "Total payable" : "Selected total";
  const statusTotal = checkoutStep === "billing" ? billing.total : selectedTotal;
  const businessApproved = business.isApproved;
  const businessOpen = businessApproved && business.open && isBusinessOpenAt(business.hours, now) && fulfillmentModes.length > 0;
  const profileVerified = customerProfileIsBookingVerified(bookingProfile);
  const bookingOpen = businessOpen && profileVerified;
  const profileNotice = bookingProfileNotice(bookingProfile, copy);
  const profileAction = bookingProfileAction(bookingProfile);
  const unavailableMessage = !businessApproved
    ? "This business is pending PSHR admin approval. Services are not available yet."
    : `This business is closed right now. You can browse, but ${transactionPluralLower} are paused until it opens.`;
  const serviceAtLocation = orderType === "SERVICE_AT_LOCATION";
  const orderTypeLabelLower = fulfillmentLabelForBusinessType(business.businessType, orderType).toLowerCase();
  const distanceKm = useMemo(() => {
    if (
      !customerLocation ||
      business.latitude === null ||
      business.longitude === null
    ) {
      return null;
    }

    return calculateDistanceKm(
      { latitude: business.latitude, longitude: business.longitude },
      customerLocation
    );
  }, [business.latitude, business.longitude, customerLocation]);
  const outsideServiceRadius =
    serviceAtLocation &&
    distanceKm !== null &&
    business.serviceRadiusKm > 0 &&
    distanceKm > business.serviceRadiusKm;

  useEffect(() => {
    if (!cartHydrated) return;

    const items = Object.fromEntries(
      Object.values(cart)
        .filter((line) => line.quantity > 0)
        .map((line) => [line.id, line.quantity])
    );

    if (Object.keys(items).length === 0) {
      window.localStorage.removeItem(cartStorageKey);
      return;
    }

    window.localStorage.setItem(
      cartStorageKey,
      JSON.stringify({
        items,
        couponCode: appliedCouponCode
      })
    );
  }, [appliedCouponCode, cart, cartHydrated, cartStorageKey]);

  useEffect(() => {
    if (!cartHydrated) return;

    if (!appliedCouponCode) return;

    if (!cartLines.length) {
      const cleanupTimer = window.setTimeout(() => {
        setAppliedCouponCode(null);
        setAppliedCoupon(null);
        setCouponNotice(null);
        setCouponError(null);
      }, 0);
      return () => window.clearTimeout(cleanupTimer);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCouponChecking(true);
      void fetchCouponPreview({
        businessSlug: business.slug,
        couponCode: appliedCouponCode,
        subtotal,
        serviceFee,
        orderType
      })
        .then((result) => {
          if (cancelled) return;
          if (result.ok) {
            setAppliedCoupon(result.coupon);
            setCouponError(null);
            setCouponNotice("Coupon discount applied.");
            return;
          }
          setAppliedCouponCode(null);
          setAppliedCoupon(null);
          setCouponNotice(null);
          setCouponError(result.error);
        })
        .catch(() => {
          if (!cancelled) setCouponError("Could not check this coupon. Please try again.");
        })
        .finally(() => {
          if (!cancelled) setCouponChecking(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [appliedCouponCode, business.slug, cartHydrated, cartLines.length, orderType, serviceFee, subtotal]);

  async function applyCoupon() {
    const code = normalizeCouponInput(couponInput);
    setCouponError(null);
    setCouponNotice(null);

    if (!code) {
      setCouponError("Enter a coupon code to apply.");
      return;
    }
    if (!cartLines.length) {
      setCouponError(`Add ${copy.itemPlural.toLowerCase()} before applying a coupon.`);
      return;
    }

    setCouponChecking(true);
    try {
      const result = await fetchCouponPreview({
        businessSlug: business.slug,
        couponCode: code,
        subtotal,
        serviceFee,
        orderType
      });
      if (!result.ok) {
        setAppliedCouponCode(null);
        setAppliedCoupon(null);
        setCouponError(result.error);
        return;
      }

      setAppliedCouponCode(code);
      setAppliedCoupon(result.coupon);
      setCouponInput("");
      setCouponNotice("Coupon discount applied.");
    } catch {
      setCouponError("Could not check this coupon. Please try again.");
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setAppliedCouponCode(null);
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
    setCouponNotice(null);
  }

  function addItem(item: DemoMenuItem) {
    if (!bookingOpen) return;
    setCart((current) => ({
      ...current,
      [item.id]: { ...item, quantity: (current[item.id]?.quantity ?? 0) + 1 }
    }));
    setCartOpen(true);
  }

  function decrement(itemId: string) {
    setCart((current) => {
      const line = current[itemId];
      if (!line) return current;
      const next = { ...current };
      if (line.quantity <= 1) delete next[itemId];
      else next[itemId] = { ...line, quantity: line.quantity - 1 };
      return next;
    });
  }

  function clearCart() {
    if (!cartLines.length) return;

    setCart({});
    removeCoupon();
    setSubmitError(null);
    setCheckoutStep("selection");
    window.localStorage.removeItem(cartStorageKey);
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cartLines.length || submitting) return;
    setSubmitError(null);
    if (!businessOpen) {
      setSubmitError(
        businessApproved
          ? "This business is closed right now."
          : "This business is pending PSHR admin approval and is not accepting requests yet."
      );
      return;
    }
    if (!profileVerified) {
      setSubmitError(profileNotice ?? "Use a verified user profile before booking.");
      return;
    }
    if (serviceAtLocation && !serviceAddress.trim()) {
      setSubmitError(`Address is required for ${orderTypeLabelLower}.`);
      return;
    }
    if (serviceAtLocation && !customerLocation) {
      setSubmitError(`Share your location to check ${orderTypeLabelLower} availability before placing this ${transactionLower}.`);
      return;
    }
    if (serviceAtLocation && distanceKm === null) {
      setSubmitError("This business has not configured a service radius yet.");
      return;
    }
    if (outsideServiceRadius) {
      setSubmitError(`Your location is outside the ${business.serviceRadiusKm.toFixed(1)} km service radius.`);
      return;
    }
    if (paymentMethod === "UPI" && !onlinePaymentAvailable) {
      setSubmitError("Automatic online payment is not configured by this business. Choose cash if available.");
      return;
    }
    if (paymentMethod === "PAY_ON_PICKUP_OR_DELIVERY" && !cashPaymentAvailable) {
      setSubmitError("Cash payment is not available for this business.");
      return;
    }
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: business.slug,
          customer: {
            name: String(form.get("name")),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone")),
            address: serviceAtLocation ? String(form.get("address") ?? "") : "",
            latitude: serviceAtLocation ? customerLocation?.latitude : undefined,
            longitude: serviceAtLocation ? customerLocation?.longitude : undefined,
            whatsappOptIn: whatsappFlowAvailable ? whatsappOptIn : false,
            marketingOptIn: whatsappFlowAvailable && whatsappOptIn ? marketingOptIn : false
          },
          orderType,
          notes: String(form.get("notes") ?? ""),
          paymentMethod,
          couponCode: appliedCouponCode ?? undefined,
          items: cartLines.map((line) => ({ menuItemId: line.id, quantity: line.quantity }))
        })
      });

      const data = (await response.json()) as OrderSubmissionResponse;
      if (!response.ok) {
        setSubmitError(typeof data.error === "string" ? data.error : `Could not place this ${transactionLower}. Please check the details and try again.`);
        return;
      }

      if (typeof data.orderNumber !== "string") {
        setSubmitError(`Could not prepare the ${transactionLower} confirmation. Please try again.`);
        return;
      }

      const confirmation = {
        orderNumber: data.orderNumber,
        orderUrl: typeof data.orderUrl === "string" ? data.orderUrl : null,
        invoiceUrl: typeof data.invoiceUrl === "string" ? data.invoiceUrl : null,
        paymentUrl: typeof data.paymentUrl === "string" ? data.paymentUrl : null,
        paymentQrImageUrl: typeof data.paymentQrImageUrl === "string" ? data.paymentQrImageUrl : null,
        paymentQrExpiresAt: typeof data.paymentQrExpiresAt === "string" ? data.paymentQrExpiresAt : null,
        whatsappNotificationSent: data.whatsappNotificationSent === true,
        message: typeof data.message === "string" ? data.message : null
      };
      setConfirmedOrder(confirmation);
      setCart({});
      removeCoupon();
      window.localStorage.removeItem(cartStorageKey);
      setCartOpen(false);
      setCheckoutStep("selection");
      const hostedCheckoutUrl =
        paymentMethod === "UPI" && confirmation.paymentUrl?.startsWith("http")
          ? confirmation.paymentUrl
          : null;
      if (hostedCheckoutUrl) {
        window.location.assign(hostedCheckoutUrl);
      } else if (confirmation.orderUrl) {
        window.location.assign(confirmation.orderUrl);
      }
    } catch {
      setSubmitError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    const cashConfirmation = paymentMethod === "PAY_ON_PICKUP_OR_DELIVERY";
    const confirmationAnimationPath = confirmedOrder.paymentQrImageUrl
      ? orderAnimationPaths.scanPay
      : cashConfirmation
        ? orderAnimationPaths.cashPaymentDue
        : orderAnimationPaths.NEW;
    const confirmationAnimationLabel = confirmedOrder.paymentQrImageUrl
      ? "Scan payment QR"
      : cashConfirmation
        ? "Cash payment due"
        : `${copy.transactionSingular} received`;

    return (
      <main className="min-h-screen bg-mesh-light px-4 py-10">
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 text-center shadow-soft">
          <LazyLottieAnimation
            src={confirmationAnimationPath}
            label={confirmationAnimationLabel}
            loop={!confirmedOrder.paymentQrImageUrl}
            className="order-confirmation-lottie mx-auto size-24 rounded-2xl border border-emerald/20 bg-white text-emerald shadow-sm"
            animationClassName={confirmedOrder.paymentQrImageUrl ? "scan-pay-lottie" : "tracking-lottie"}
            fallback={<CheckCircle2 className="size-10" />}
          />
          <h1 className="mt-5 text-2xl font-bold text-ink">
            {copy.transactionSingular} received
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {confirmedOrder.message ??
              `Your ${copy.transactionSingular.toLowerCase()} ${confirmedOrder.orderNumber} is saved with ${business.name}.`}
          </p>
          {confirmedOrder.whatsappNotificationSent && (
            <p className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-emerald/5 p-3 text-sm font-semibold text-emerald">
              <MessageCircle className="size-4" /> Confirmation sent on WhatsApp
            </p>
          )}
          {confirmedOrder.paymentQrImageUrl && (
            <div className="mt-6 rounded-lg border border-line bg-mist p-4">
              <Image
                src={confirmedOrder.paymentQrImageUrl}
                alt={`UPI QR for ${confirmedOrder.orderNumber}`}
                width={224}
                height={224}
                unoptimized
                className="mx-auto size-56 rounded-lg bg-white object-contain p-2"
              />
              {confirmedOrder.paymentQrExpiresAt && (
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  QR expires at {new Date(confirmedOrder.paymentQrExpiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          )}
          {confirmedOrder.paymentUrl && (
            <a
              href={confirmedOrder.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-black/90"
            >
              <Wallet className="size-4" />
              <span>{confirmedOrder.paymentQrImageUrl ? "Open Payment QR" : "Open Secure Payment"}</span>
              <ExternalLink className="size-4" />
            </a>
          )}
          {confirmedOrder.invoiceUrl && (
            <a href={confirmedOrder.invoiceUrl} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink">
              <ReceiptText className="size-4" /> View Invoice
            </a>
          )}
          <Button className="mt-6 w-full" onClick={() => setConfirmedOrder(null)}>
            Place Another {copy.transactionSingular}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="public-order-shell min-h-screen pb-28 text-ink xl:pb-0">
      <div className="public-order-header-spacer">
        <header className="public-order-fixed-header fixed inset-x-0 top-0 z-40 border-b border-white/70 bg-white/95 px-4 pb-3 shadow-[0_16px_40px_rgba(13,19,33,0.08)] backdrop-blur-2xl lg:pb-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <Link href="/" className="grid size-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-emerald/30 focus:outline-none focus:ring-4 focus:ring-emerald/15">
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink sm:text-base">{business.name}</p>
              <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{business.city}, {business.state}</p>
            </div>
            <Button
              variant="emerald"
              size="sm"
              className="h-11 shrink-0 rounded-lg bg-ink px-4 shadow-[0_18px_40px_rgba(13,19,33,0.18)] hover:bg-[#16382f]"
              icon={<TransactionIcon className="size-4" />}
              onClick={() => setCartOpen(true)}
            >
              {cartItemCount}
            </Button>
          </div>
        </header>
      </div>

      <section className="public-order-hero px-4 py-7 text-white sm:py-9">
        {heroImageUrl && (
          <Image
            src={heroImageUrl}
            alt={`${business.name} ambience`}
            fill
            sizes="100vw"
            className="absolute inset-0 z-0 object-cover opacity-[0.22] saturate-[0.85]"
            unoptimized={heroImageIsSvg}
            priority
          />
        )}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(13,19,33,0.92),rgba(13,19,33,0.76)_48%,rgba(13,19,33,0.9))]" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-5">
              <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/25 bg-white text-2xl font-extrabold text-ink shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:size-24">
                {business.logoUrl ? (
                  <Image
                    src={business.logoUrl}
                    alt={`${business.name} image`}
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized={business.logoUrl.toLowerCase().split("?")[0].endsWith(".svg")}
                  />
                ) : (
                  business.logoText
                )}
              </div>
              <div className="min-w-0 self-center sm:self-start">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-bold text-white/80 backdrop-blur">
                    <BusinessIcon className="size-3.5 text-[#f4d58d]" />
                    {business.businessType}
                  </span>
                  <Badge variant={businessOpen ? "emerald" : "red"} className={cn("border-white/20 bg-white/10 text-white", businessOpen && "border-emerald/30 bg-emerald/20 text-emerald-50")}>
                    {businessOpen ? "Open now" : businessApproved ? "Closed" : "Pending approval"}
                  </Badge>
                </div>
                <h1 className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
                  {business.name}
                </h1>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
                <p className="mt-3 flex max-w-4xl gap-2 text-sm leading-6 text-white/80 sm:text-base">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[#f4d58d]" />
                  <span>{business.address}</span>
                </p>
                <BusinessHoursDisclosure
                  businessId={business.id}
                  hours={business.hours}
                  open={businessOpen}
                  now={now}
                  showSummary={false}
                  variant="hero"
                  leadingIcon={<Clock3 className="mt-0.5 size-4 shrink-0 text-emerald-200" />}
                  className="mt-2 max-w-4xl"
                />
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-white/80">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                    <TransactionIcon className="size-3.5 text-emerald-200" />
                    {copy.minimumValueLabel} {formatINR(business.minimumOrder)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                    <FulfillmentModeIcon mode={fulfillmentModes[0]} />
                    {fulfillmentSummaryForBusinessType(business.businessType, fulfillmentModes)}
                  </span>
                  {business.serviceRadiusKm > 0 && fulfillmentModes.includes("SERVICE_AT_LOCATION") && (
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{business.serviceRadiusKm.toFixed(1)} km service radius</span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{business.whatsappAvailable ? "WhatsApp direct" : `Website ${copy.transactionPlural.toLowerCase()}`}</span>
                </div>
              </div>
            </div>

            <div className="hidden rounded-lg border border-white/20 bg-white/[0.08] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-md lg:block">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white/60">{copy.transactionSingular} status</p>
                  <p className="mt-1 text-lg font-extrabold text-white">
                    {businessOpen ? `Ready for ${copy.transactionPlural.toLowerCase()}` : "Not accepting now"}
                  </p>
                </div>
                <span className="grid size-11 place-items-center rounded-lg bg-emerald/20 text-emerald-100">
                  <Sparkles className="size-5" />
                </span>
              </div>
              <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm">
                <div className="flex items-center justify-between gap-3 text-white/70">
                  <span>Selected</span>
                  <span className="font-extrabold text-white">{cartItemCount} {cartItemCount === 1 ? copy.itemSingular.toLowerCase() : copy.itemPlural.toLowerCase()}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-white/70">
                  <span>{statusTotalLabel}</span>
                  <span className="font-extrabold text-white">{formatINR(statusTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-white/70">
                  <span>Checkout</span>
                  <span className="font-extrabold text-emerald-100">{onlinePaymentAvailable ? "Online pay" : cashPaymentAvailable ? "Cash pay" : "Pending"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid min-w-0 max-w-[100rem] gap-6 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {checkoutStep === "selection" ? (
          <div className="min-w-0">
            <div className="public-order-sticky-controls sticky z-30 -mx-4 min-w-0 border-b border-white/70 bg-white/[0.82] px-4 py-4 shadow-[0_18px_46px_rgba(13,19,33,0.07)] backdrop-blur-2xl sm:mx-0 sm:rounded-lg sm:border">
              {!businessOpen && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{unavailableMessage}</span>
                </div>
              )}
              {businessOpen && profileNotice && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <span className="flex min-w-0 items-start gap-2">
                    <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                    <span>{profileNotice}</span>
                  </span>
                  {profileAction && (
                    <ButtonLink href={profileAction.href} size="sm" variant="secondary" className="bg-white">
                      {profileAction.label}
                    </ButtonLink>
                  )}
                </div>
              )}
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-3.5 size-5 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="h-12 border-white/80 bg-white/[0.92] pl-12 text-base shadow-sm focus:border-emerald focus:ring-emerald/20"
                />
              </div>
              <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5",
                      category === activeCategory
                        ? "border-ink bg-ink text-white shadow-[0_16px_34px_rgba(13,19,33,0.18)]"
                        : "border-white/90 bg-white/[0.92] text-slate-700 hover:border-emerald/30"
                    )}
                  >
                    <CategoryIcon className="size-3.5" />
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 -mx-1 grid min-w-0 grid-cols-2 items-stretch gap-2.5 sm:mx-0 sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] sm:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
              {menuPagination.pageItems.map((item) => {
                const quantity = cart[item.id]?.quantity ?? 0;
                const showFoodMarker = item.foodType !== "NOT_APPLICABLE";
                return (
                  <article key={item.id} className="public-service-card flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-white/[0.85] bg-white/[0.94] p-2.5 shadow-[0_18px_52px_rgba(13,19,33,0.08)] backdrop-blur sm:p-3">
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 52vw, (max-width: 1024px) 30vw, (max-width: 1536px) 18vw, 210px"
                          className="object-cover transition duration-300 hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center bg-[linear-gradient(135deg,rgba(17,166,106,0.14),rgba(18,70,160,0.12),rgba(244,213,141,0.16))] text-ocean">
                          <ItemIcon className="size-8" />
                        </div>
                      )}
                      {item.isBestSeller && <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full border border-white/70 bg-[#fff7df] px-2 py-0.5 text-[9px] font-extrabold text-[#6f4610] shadow-sm sm:left-2 sm:top-2 sm:px-2.5 sm:py-1 sm:text-[10px]">Best seller</span>}
                    </div>
                  <div className="flex min-w-0 flex-1 flex-col pt-2.5">
                    {(showFoodMarker || !item.isAvailable) && (
                      <div className="flex min-w-0 items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          {showFoodMarker && (
                            <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-sm border", item.foodType === "NON_VEG" ? "border-red-600" : item.foodType === "EGG" ? "border-amber-600" : "border-emerald")}>
                              <span className={cn("size-1.5 rounded-full", item.foodType === "NON_VEG" ? "bg-red-600" : item.foodType === "EGG" ? "bg-amber-600" : "bg-emerald")} />
                            </span>
                          )}
                        </div>
                        {!item.isAvailable && <Badge variant="red" className="px-2 py-0.5 text-[10px]">Unavailable</Badge>}
                      </div>
                    )}
                    <h2 className="mt-1 line-clamp-2 break-words text-[13px] font-extrabold leading-[1.18] text-ink sm:text-[15px]">{item.name}</h2>
                    <ServiceDescriptionPreview item={item} onReadMore={setDescriptionModalItem} />
                    <div className="grid gap-2 pt-2">
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <p className="text-[11px] font-bold text-slate-400 sm:text-xs">Price</p>
                        <p className="min-w-0 truncate text-right text-base font-extrabold leading-tight text-ink sm:text-lg">{formatINR(item.price)}</p>
                      </div>
                      {quantity > 0 ? (
                        <div className="grid h-9 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] overflow-hidden rounded-lg border border-emerald/30 bg-emerald/10 shadow-sm">
                          <button type="button" className="grid h-9 place-items-center text-emerald" onClick={() => decrement(item.id)} aria-label={`Remove one ${item.name}`}>
                            <Minus className="size-4" />
                          </button>
                          <span className="grid min-w-0 place-items-center text-sm font-bold text-emerald">{quantity}</span>
                          <button type="button" className="grid h-9 place-items-center text-emerald disabled:cursor-not-allowed disabled:opacity-60" onClick={() => addItem(item)} disabled={!bookingOpen || !item.isAvailable} aria-label={`Add one ${item.name}`}>
                            <Plus className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" className="h-9 w-full border-emerald/25 bg-emerald/10 text-emerald hover:border-emerald/40 hover:bg-emerald/20" onClick={() => addItem(item)} disabled={!bookingOpen || !item.isAvailable}>
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="public-order-panel col-span-full p-5 text-sm font-semibold text-slate-600">
                No {copy.itemPlural.toLowerCase()} match this selection.
              </div>
            )}
            <PaginationControls
              className="public-order-panel col-span-full"
              page={menuPagination.page}
              pageCount={menuPagination.pageCount}
              totalItems={menuPagination.totalItems}
              startItem={menuPagination.startItem}
              endItem={menuPagination.endItem}
              itemLabel={copy.itemPlural.toLowerCase()}
              onPageChange={menuPagination.setPage}
            />
          </div>
        </div>
        ) : (
          <BillingSelectedServicesPanel
            business={business}
            copy={copy}
            selectionTitle={selectionTitle}
            cartLines={cartLines}
            subtotal={subtotal}
            decrement={decrement}
            addItem={addItem}
            bookingOpen={bookingOpen}
            onClearCart={clearCart}
            onBack={() => setCheckoutStep("selection")}
          />
        )}

        <aside className="hidden xl:block">
          {checkoutStep === "selection" ? (
            <SelectionPanel
              business={business}
              copy={copy}
              selectionTitle={selectionTitle}
              cartLines={cartLines}
              subtotal={subtotal}
              decrement={decrement}
              addItem={addItem}
              bookingOpen={bookingOpen}
              businessOpen={businessOpen}
              profileVerified={profileVerified}
              onClearCart={clearCart}
              onContinue={() => setCheckoutStep("billing")}
            />
          ) : (
            <BillingPanel
              business={business}
              copy={copy}
              selectionTitle={selectionTitle}
              cartLines={cartLines}
              billing={billing}
              fulfillmentModes={fulfillmentModes}
              orderType={orderType}
              setOrderType={setOrderType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              whatsappOptIn={whatsappOptIn}
              setWhatsappOptIn={setWhatsappOptIn}
              marketingOptIn={marketingOptIn}
              setMarketingOptIn={setMarketingOptIn}
              decrement={decrement}
              addItem={addItem}
              submitOrder={submitOrder}
              submitError={submitError}
              submitting={submitting}
              businessOpen={businessOpen}
              bookingOpen={bookingOpen}
              bookingProfile={bookingProfile}
              profileVerified={profileVerified}
              profileNotice={profileNotice}
              profileAction={profileAction}
              customerLocation={customerLocation}
              setCustomerLocation={setCustomerLocation}
              serviceAddress={serviceAddress}
              setServiceAddress={setServiceAddress}
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              appliedCoupon={appliedCoupon}
              couponError={couponError}
              couponNotice={couponNotice}
              couponChecking={couponChecking}
              applyCoupon={applyCoupon}
              removeCoupon={removeCoupon}
              distanceKm={distanceKm}
              outsideServiceRadius={outsideServiceRadius}
              onClearCart={clearCart}
              onBack={() => setCheckoutStep("selection")}
              showSelectedServices={false}
            />
          )}
        </aside>
      </section>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 xl:hidden">
          <div className="safe-bottom absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-lg border-t border-white/70 bg-white/[0.94] p-4 shadow-[0_-24px_80px_rgba(13,19,33,0.22)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              {checkoutStep === "selection" ? (
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink text-white shadow-[0_14px_32px_rgba(13,19,33,0.18)]">
                    <TransactionIcon className="size-4" />
                  </span>
                  <h2 className="truncate text-lg font-extrabold text-ink">
                    Your {selectionTitle.toLowerCase()}
                  </h2>
                </div>
              ) : (
                <h2 className="min-w-0 flex-1 text-lg font-extrabold text-ink">Billing details</h2>
              )}
              {checkoutStep === "selection" && cartLines.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn("ml-2 shrink-0", clearSelectionButtonClass)}
                  icon={<Trash2 className="size-3" />}
                  aria-label={selectionClearLabel}
                  onClick={clearCart}
                >
                  {selectionClearLabel}
                </Button>
              )}
              <button
                type="button"
                aria-label="Close selected services"
                title="Close"
                className="ml-2 grid size-11 shrink-0 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                onClick={() => setCartOpen(false)}
              >
                <X className="size-6 stroke-[2.4]" />
              </button>
            </div>
            {checkoutStep === "selection" ? (
              <SelectionPanel
                business={business}
                copy={copy}
                selectionTitle={selectionTitle}
                cartLines={cartLines}
                subtotal={subtotal}
                decrement={decrement}
                addItem={addItem}
                bookingOpen={bookingOpen}
                businessOpen={businessOpen}
                profileVerified={profileVerified}
                onClearCart={clearCart}
                showSelectionHeading={false}
                onContinue={() => setCheckoutStep("billing")}
              />
            ) : (
              <BillingPanel
                business={business}
                copy={copy}
                selectionTitle={selectionTitle}
                cartLines={cartLines}
                billing={billing}
                fulfillmentModes={fulfillmentModes}
                orderType={orderType}
                setOrderType={setOrderType}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                whatsappOptIn={whatsappOptIn}
                setWhatsappOptIn={setWhatsappOptIn}
                marketingOptIn={marketingOptIn}
                setMarketingOptIn={setMarketingOptIn}
                decrement={decrement}
                addItem={addItem}
                submitOrder={submitOrder}
                submitError={submitError}
                submitting={submitting}
                businessOpen={businessOpen}
                bookingOpen={bookingOpen}
                bookingProfile={bookingProfile}
                profileVerified={profileVerified}
                profileNotice={profileNotice}
                profileAction={profileAction}
                customerLocation={customerLocation}
                setCustomerLocation={setCustomerLocation}
                serviceAddress={serviceAddress}
                setServiceAddress={setServiceAddress}
                couponInput={couponInput}
                setCouponInput={setCouponInput}
                appliedCoupon={appliedCoupon}
                couponError={couponError}
                couponNotice={couponNotice}
                couponChecking={couponChecking}
                applyCoupon={applyCoupon}
                removeCoupon={removeCoupon}
                distanceKm={distanceKm}
                outsideServiceRadius={outsideServiceRadius}
                onClearCart={clearCart}
                onBack={() => setCheckoutStep("selection")}
              />
            )}
          </div>
        </div>
      )}

      {descriptionModalItem && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="service-description-title">
          <div className="w-full max-w-md rounded-lg border border-white/80 bg-white p-5 shadow-[0_24px_90px_rgba(13,19,33,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald">{descriptionModalItem.category}</p>
                <h2 id="service-description-title" className="mt-1 text-lg font-extrabold leading-tight text-ink">
                  {descriptionModalItem.name}
                </h2>
              </div>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-ink transition hover:bg-slate-200"
                onClick={() => setDescriptionModalItem(null)}
                aria-label="Close description"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 rounded-lg border border-line bg-[#f6faf8] p-4">
              <p className="text-xs font-extrabold uppercase text-slate-400">Description details</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {descriptionModalItem.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ServiceDescriptionPreview({
  item,
  onReadMore
}: {
  item: DemoMenuItem;
  onReadMore: (item: DemoMenuItem) => void;
}) {
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);

  useEffect(() => {
    const element = descriptionRef.current;
    if (!element) return;

    const updateOverflow = () => {
      setDescriptionOverflows(element.scrollHeight > element.clientHeight + 1);
    };

    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.description]);

  return (
    <div className="mt-1 min-h-[2.35rem]">
      <p ref={descriptionRef} className="line-clamp-2 break-words text-[11px] leading-[1.45] text-slate-600 sm:text-xs">
        {item.description}
      </p>
      {descriptionOverflows && (
        <button
          type="button"
          className="mt-0.5 text-[11px] font-extrabold text-emerald transition hover:text-ink"
          onClick={() => onReadMore(item)}
        >
          ...read more
        </button>
      )}
    </div>
  );
}

function OrderBillingSummary({
  billing,
  copy,
  totalLabel
}: {
  billing: OrderBillingBreakdown;
  copy: BusinessConsoleCopy;
  totalLabel: string;
}) {
  return (
    <div className="mt-5 grid gap-2 rounded-lg border border-white bg-[#f6faf8] p-4 text-sm shadow-sm">
      <div className="flex justify-between text-slate-600"><span>Prices total</span><span>{formatINR(billing.subtotal)}</span></div>
      {billing.serviceFee > 0 && (
        <div className="flex justify-between text-slate-600"><span>{copy.serviceFeeLabel}</span><span>{formatINR(billing.serviceFee)}</span></div>
      )}
      {billing.discount > 0 && (
        <div className="flex justify-between text-emerald"><span>Coupon discount</span><span>-{formatINR(billing.discount)}</span></div>
      )}
      {billing.gstAmount > 0 && (
        <>
          <div className="flex justify-between border-t border-line/80 pt-3 text-slate-600"><span>Taxable amount</span><span>{formatINR(billing.taxableAmount)}</span></div>
          <div className="flex justify-between text-slate-600"><span>GST {gstRateLabel(billing.gstRateBps)}</span><span>{formatINR(billing.gstAmount)}</span></div>
        </>
      )}
      <div className="mt-1 flex justify-between border-t border-line/80 pt-3 text-lg font-extrabold text-ink"><span>{totalLabel}</span><span>{formatINR(billing.total)}</span></div>
    </div>
  );
}

function SelectedItemsSummary({ subtotal }: { subtotal: number }) {
  const total = money(subtotal);

  return (
    <div className="mt-5 grid gap-2 rounded-lg border border-white bg-[#f6faf8] p-4 text-sm shadow-sm">
      <div className="flex justify-between text-slate-600"><span>Prices total</span><span>{formatINR(total)}</span></div>
      <div className="mt-1 flex justify-between border-t border-line/80 pt-3 text-lg font-extrabold text-ink"><span>Selected total</span><span>{formatINR(total)}</span></div>
    </div>
  );
}

function SelectionPanel({
  business,
  copy,
  selectionTitle,
  cartLines,
  subtotal,
  decrement,
  addItem,
  bookingOpen,
  businessOpen,
  profileVerified,
  onClearCart,
  showSelectionHeading = true,
  onContinue
}: {
  business: DemoBusiness;
  copy: BusinessConsoleCopy;
  selectionTitle: string;
  cartLines: CartLine[];
  subtotal: number;
  decrement: (itemId: string) => void;
  addItem: (item: DemoMenuItem) => void;
  bookingOpen: boolean;
  businessOpen: boolean;
  profileVerified: boolean;
  onClearCart: () => void;
  showSelectionHeading?: boolean;
  onContinue: () => void;
}) {
  const icons = getBusinessConsoleIcons(business.businessType);
  const TransactionIcon = icons.transactionIcon;
  const ItemIcon = icons.itemIcon;
  const clearLabel = clearSelectionLabel(copy);
  const continueDisabled = !businessOpen || !profileVerified || !cartLines.length || subtotal < business.minimumOrder;
  const continueLabel = !businessOpen
    ? "Unavailable"
    : !profileVerified
      ? "Sign in to continue"
      : !cartLines.length
        ? `Select ${copy.itemPlural.toLowerCase()}`
        : subtotal < business.minimumOrder
          ? `${copy.minimumValueLabel} ${formatINR(business.minimumOrder)}`
          : "Continue to billing";

  return (
    <section className="public-order-panel p-5 xl:sticky xl:top-24">
      {showSelectionHeading ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-extrabold text-ink">{selectionTitle}</h2>
          {cartLines.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className={cn("shrink-0", clearSelectionButtonClass)}
              icon={<Trash2 className="size-3" />}
              aria-label={clearLabel}
              onClick={onClearCart}
            >
              {clearLabel}
            </Button>
          )}
        </div>
      ) : null}
      {cartLines.length === 0 ? (
        <p className={cn("flex items-start gap-3 rounded-lg border border-emerald/20 bg-[linear-gradient(135deg,rgba(17,166,106,0.08),rgba(18,70,160,0.06))] p-4 text-sm leading-6 text-slate-600", showSelectionHeading ? "mt-5" : "mt-0")}>
          <ItemIcon className="mt-0.5 size-5 shrink-0 text-emerald" />
          <span>
            Add {copy.itemPlural.toLowerCase()} to place a {copy.transactionSingular.toLowerCase()} on the website.
          </span>
        </p>
      ) : (
        <div className={cn("divide-y divide-line/80", showSelectionHeading ? "mt-4" : "mt-3")}>
          {cartLines.map((line) => (
            <div key={line.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{line.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatINR(line.price)} each</p>
                </div>
                <p className="text-sm font-extrabold text-ink">{formatINR(line.price * line.quantity)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Quantity</span>
                <div className="flex h-9 items-center rounded-lg border border-emerald/20 bg-emerald/5">
                  <button type="button" className="grid size-9 place-items-center text-emerald" onClick={() => decrement(line.id)}>
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-emerald">{line.quantity}</span>
                  <button type="button" className="grid size-9 place-items-center text-emerald disabled:cursor-not-allowed disabled:opacity-60" onClick={() => addItem(line)} disabled={!bookingOpen}>
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SelectedItemsSummary subtotal={subtotal} />

      <Button type="button" variant="emerald" className="mt-5 h-12 w-full shadow-[0_18px_44px_rgba(17,166,106,0.28)] hover:bg-[#0f915f]" icon={<TransactionIcon className="size-4" />} disabled={continueDisabled} onClick={onContinue}>
        {continueLabel}
      </Button>
    </section>
  );
}

function BillingSelectedServicesPanel({
  business,
  copy,
  selectionTitle,
  cartLines,
  subtotal,
  decrement,
  addItem,
  bookingOpen,
  onClearCart,
  onBack
}: {
  business: DemoBusiness;
  copy: BusinessConsoleCopy;
  selectionTitle: string;
  cartLines: CartLine[];
  subtotal: number;
  decrement: (itemId: string) => void;
  addItem: (item: DemoMenuItem) => void;
  bookingOpen: boolean;
  onClearCart: () => void;
  onBack: () => void;
}) {
  const icons = getBusinessConsoleIcons(business.businessType);
  const ItemIcon = icons.itemIcon;
  const clearLabel = clearSelectionLabel(copy);

  return (
    <section className="public-order-panel p-5 xl:sticky xl:top-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 truncate text-lg font-extrabold text-ink">{selectionTitle}</h2>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {cartLines.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className={clearSelectionButtonClass}
              icon={<Trash2 className="size-3" />}
              aria-label={clearLabel}
              onClick={onClearCart}
            >
              {clearLabel}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="border-emerald/25 bg-emerald/10 text-emerald hover:border-emerald/40 hover:bg-emerald/20"
            icon={<ChevronLeft className="size-3.5" />}
            onClick={onBack}
          >
            Change
          </Button>
        </div>
      </div>

      {cartLines.length === 0 ? (
        <p className="mt-5 flex items-start gap-3 rounded-lg border border-emerald/20 bg-[linear-gradient(135deg,rgba(17,166,106,0.08),rgba(18,70,160,0.06))] p-4 text-sm leading-6 text-slate-600">
          <ItemIcon className="mt-0.5 size-5 shrink-0 text-emerald" />
          <span>
            Add {copy.itemPlural.toLowerCase()} to place a {copy.transactionSingular.toLowerCase()} on the website.
          </span>
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {cartLines.map((line) => {
            const lineImageIsSvg = line.imageUrl?.toLowerCase().split("?")[0].endsWith(".svg") ?? false;

            return (
              <article key={line.id} className="grid gap-3 rounded-lg border border-white bg-white/[0.78] p-3 shadow-sm sm:grid-cols-[104px_minmax(0,1fr)_156px] sm:items-center">
                <div className="relative h-28 overflow-hidden rounded-md bg-slate-100 sm:h-24">
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt={line.name} fill sizes="120px" className="object-cover" unoptimized={lineImageIsSvg} />
                  ) : (
                    <div className="grid h-full place-items-center bg-[linear-gradient(135deg,rgba(17,166,106,0.14),rgba(18,70,160,0.12),rgba(244,213,141,0.16))] text-ocean">
                      <ItemIcon className="size-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald">{line.category}</p>
                  <h3 className="mt-1 truncate text-base font-extrabold text-ink">{line.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{formatINR(line.price)} each</p>
                  <p className="mt-2 text-sm font-extrabold text-ink sm:hidden">{formatINR(line.price * line.quantity)}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="hidden text-sm font-extrabold text-ink sm:block">{formatINR(line.price * line.quantity)}</p>
                  <div className="flex h-10 items-center rounded-lg border border-emerald/20 bg-emerald/5">
                    <button type="button" className="grid size-10 place-items-center text-emerald" onClick={() => decrement(line.id)}>
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-emerald">{line.quantity}</span>
                    <button type="button" className="grid size-10 place-items-center text-emerald disabled:cursor-not-allowed disabled:opacity-60" onClick={() => addItem(line)} disabled={!bookingOpen}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <SelectedItemsSummary subtotal={subtotal} />
    </section>
  );
}

function BillingPanel({
  business,
  copy,
  selectionTitle,
  cartLines,
  billing,
  fulfillmentModes,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  whatsappOptIn,
  setWhatsappOptIn,
  marketingOptIn,
  setMarketingOptIn,
  decrement,
  addItem,
  submitOrder,
  submitError,
  submitting,
  businessOpen,
  bookingOpen,
  bookingProfile,
  profileVerified,
  profileNotice,
  profileAction,
  customerLocation,
  setCustomerLocation,
  serviceAddress,
  setServiceAddress,
  couponInput,
  setCouponInput,
  appliedCoupon,
  couponError,
  couponNotice,
  couponChecking,
  applyCoupon,
  removeCoupon,
  distanceKm,
  outsideServiceRadius,
  onClearCart,
  onBack,
  showSelectedServices = true
}: {
  business: DemoBusiness;
  copy: BusinessConsoleCopy;
  selectionTitle: string;
  cartLines: CartLine[];
  billing: OrderBillingBreakdown;
  fulfillmentModes: ActiveFulfillmentMode[];
  orderType: ActiveFulfillmentMode;
  setOrderType: (type: ActiveFulfillmentMode) => void;
  paymentMethod: "UPI" | "PAY_ON_PICKUP_OR_DELIVERY";
  setPaymentMethod: (method: "UPI" | "PAY_ON_PICKUP_OR_DELIVERY") => void;
  whatsappOptIn: boolean;
  setWhatsappOptIn: (value: boolean) => void;
  marketingOptIn: boolean;
  setMarketingOptIn: (value: boolean) => void;
  decrement: (itemId: string) => void;
  addItem: (item: DemoMenuItem) => void;
  submitOrder: (event: React.FormEvent<HTMLFormElement>) => void;
  submitError: string | null;
  submitting: boolean;
  businessOpen: boolean;
  bookingOpen: boolean;
  bookingProfile: CustomerBookingProfile;
  profileVerified: boolean;
  profileNotice: string | null;
  profileAction: { href: string; label: string } | null;
  customerLocation: CustomerLocation | null;
  setCustomerLocation: (value: CustomerLocation | null) => void;
  serviceAddress: string;
  setServiceAddress: (value: string) => void;
  couponInput: string;
  setCouponInput: (value: string) => void;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  couponNotice: string | null;
  couponChecking: boolean;
  applyCoupon: () => void;
  removeCoupon: () => void;
  distanceKm: number | null;
  outsideServiceRadius: boolean;
  onClearCart: () => void;
  onBack: () => void;
  showSelectedServices?: boolean;
}) {
  const icons = getBusinessConsoleIcons(business.businessType);
  const TransactionIcon = icons.transactionIcon;
  const ItemIcon = icons.itemIcon;
  const serviceAtLocation = orderType === "SERVICE_AT_LOCATION";
  const orderTypeLabel = fulfillmentLabelForBusinessType(business.businessType, orderType);
  const orderTypeLabelLower = orderTypeLabel.toLowerCase();
  const addressLabel = orderTypeLabelLower.includes("delivery")
    ? "Delivery address"
    : orderTypeLabelLower.includes("home")
      ? "Home address"
      : "Service address";
  const subtotal = billing.subtotal;
  const transactionLower = copy.transactionSingular.toLowerCase();
  const onlinePaymentAvailable = business.onlinePaymentAvailable;
  const cashPaymentAvailable = business.allowsPayOnDelivery;
  const paymentMethodAvailable = paymentMethod === "UPI" ? onlinePaymentAvailable : cashPaymentAvailable;
  const clearLabel = clearSelectionLabel(copy);
  const submitDisabled =
    submitting ||
    !businessOpen ||
    !profileVerified ||
    !cartLines.length ||
    subtotal < business.minimumOrder ||
    !paymentMethodAvailable ||
    (serviceAtLocation && (!serviceAddress.trim() || !customerLocation || distanceKm === null || outsideServiceRadius));
  const submitLabel = !businessOpen
    ? "Unavailable"
    : !profileVerified
      ? bookingProfile.status === "guest"
        ? `Sign in to ${copy.transactionSingular === "Order" ? "order" : "book"}`
        : bookingProfile.status === "wrong_role"
          ? "User account required"
          : "Verify profile"
    : submitting
      ? `Placing ${transactionLower}`
      : subtotal < business.minimumOrder
        ? `${copy.minimumValueLabel} ${formatINR(business.minimumOrder)}`
        : serviceAtLocation && !serviceAddress.trim()
          ? `Add ${addressLabel.toLowerCase()}`
          : serviceAtLocation && !customerLocation
          ? "Share location"
          : serviceAtLocation && distanceKm === null
            ? "Service radius unavailable"
          : outsideServiceRadius
            ? "Outside service radius"
            : !paymentMethodAvailable
              ? "Payment unavailable"
            : paymentMethod === "UPI"
              ? `Place ${copy.transactionSingular} and pay online`
              : `Place ${copy.transactionSingular} with cash`;

  return (
    <form onSubmit={submitOrder} className="public-order-panel p-5 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-emerald" onClick={onBack}>
            <ChevronLeft className="size-3.5" />
            {selectionTitle}
          </button>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-ink text-white shadow-[0_18px_40px_rgba(13,19,33,0.18)]">
              <ReceiptText className="size-5" />
            </span>
            <h2 className="text-lg font-extrabold text-ink">Billing details</h2>
          </div>
        </div>
        <Badge variant="emerald" className="gap-1.5 border-emerald/25 bg-emerald/10">
          <ShieldCheck className="size-3.5" />
          Secure
        </Badge>
      </div>
      {showSelectedServices && (
        cartLines.length === 0 ? (
          <p className="mt-5 flex items-start gap-3 rounded-lg border border-emerald/20 bg-[linear-gradient(135deg,rgba(17,166,106,0.08),rgba(18,70,160,0.06))] p-4 text-sm leading-6 text-slate-600">
            <ItemIcon className="mt-0.5 size-5 shrink-0 text-emerald" />
            <span>
              Add {copy.itemPlural.toLowerCase()} to place a {copy.transactionSingular.toLowerCase()} on the website.
            </span>
          </p>
        ) : (
          <div className="mt-5 rounded-lg border border-white bg-[#f6faf8] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-line/80 pb-3">
              <p className="min-w-0 truncate text-sm font-extrabold text-ink">{selectionTitle}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className={cn("shrink-0", clearSelectionButtonClass)}
                icon={<Trash2 className="size-3" />}
                aria-label={clearLabel}
                onClick={onClearCart}
              >
                {clearLabel}
              </Button>
            </div>
            {cartLines.map((line) => (
              <div key={line.id} className="mt-3 flex items-center justify-between gap-3 border-t border-line/80 pt-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{line.name}</p>
                </div>
                <div className="flex h-9 items-center rounded-lg border border-emerald/20 bg-white">
                  <button type="button" className="grid size-9 place-items-center text-emerald" onClick={() => decrement(line.id)}>
                    <Minus className="size-4" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold text-emerald">{line.quantity}</span>
                  <button type="button" className="grid size-9 place-items-center text-emerald disabled:cursor-not-allowed disabled:opacity-60" onClick={() => addItem(line)} disabled={!bookingOpen}>
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {businessOpen && profileNotice && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="flex min-w-0 items-start gap-2">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            <span>{profileNotice}</span>
          </span>
          {profileAction && (
            <ButtonLink href={profileAction.href} size="sm" variant="secondary" className="bg-white">
              {profileAction.label}
            </ButtonLink>
          )}
        </div>
      )}

      <div
        className="mt-5 grid gap-2 rounded-lg bg-[#edf4f2] p-1 shadow-inner"
        style={{ gridTemplateColumns: `repeat(${fulfillmentModes.length}, minmax(0, 1fr))` }}
      >
        {fulfillmentModes.map((type) => {
          return (
            <button
              key={type}
              type="button"
              onClick={() => setOrderType(type)}
              className={cn("flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-bold transition", orderType === type ? "bg-white text-ink shadow-[0_10px_24px_rgba(13,19,33,0.10)]" : "text-slate-600 hover:text-ink")}
            >
              <FulfillmentModeIcon mode={type} />
              {fulfillmentLabelForBusinessType(business.businessType, type)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="name">{copy.customerSingular} name</Label>
          <Input
            id="name"
            name="name"
            placeholder={`${copy.customerSingular} name`}
            defaultValue={profileVerified ? bookingProfile.name : ""}
            readOnly={profileVerified}
            className={cn("h-12 bg-white/[0.86] shadow-sm focus:border-emerald focus:ring-emerald/20", profileVerified && "bg-slate-50")}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email <span className="font-normal text-slate-400">(optional)</span></Label>
          <EmailInput
            id="email"
            name="email"
            placeholder="you@example.com"
            defaultValue={profileVerified ? bookingProfile.email : ""}
            readOnly={profileVerified}
            className={cn("h-12 bg-white/[0.86] shadow-sm focus:border-emerald focus:ring-emerald/20", profileVerified && "bg-slate-50")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone number</Label>
          <PhoneInput
            id="phone"
            name="phone"
            defaultValue={profileVerified ? bookingProfile.phone : ""}
            disabled={profileVerified}
            className="h-12 bg-white/[0.86] shadow-sm focus:border-emerald focus:ring-emerald/20"
            required
          />
        </div>
        {serviceAtLocation && (
          <div className="grid gap-3 rounded-lg border border-white bg-[#f6faf8] p-3 shadow-sm">
            <div className="grid gap-2">
              <Label htmlFor="address">{addressLabel}</Label>
              <Textarea
                id="address"
                name="address"
                placeholder="House number, street, area, landmark"
                value={serviceAddress}
                onChange={(event) => setServiceAddress(event.currentTarget.value)}
                className="bg-white/[0.86] shadow-sm focus:border-emerald focus:ring-emerald/20"
                required
              />
            </div>
            <CustomerLocationMapPicker
              value={customerLocation}
              onChange={setCustomerLocation}
              onAddressSelect={(address) => {
                if (!serviceAddress.trim()) setServiceAddress(address);
              }}
              businessLatitude={business.latitude}
              businessLongitude={business.longitude}
              serviceRadiusKm={business.serviceRadiusKm}
              suggestedQuery={[serviceAddress, business.city, business.state].filter(Boolean).join(", ")}
            />
            {customerLocation && distanceKm !== null && (
              <Badge variant={outsideServiceRadius ? "red" : "emerald"} className="w-fit">
                {distanceKm.toFixed(1)} km away
              </Badge>
            )}
          </div>
        )}
        {!businessOpen && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{business.isApproved ? `${copy.transactionPlural} are paused until the business is open.` : "This business is pending PSHR admin approval."}</span>
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="notes">{copy.transactionSingular} notes</Label>
          <Input id="notes" name="notes" placeholder="Timing, preferences, or special instructions" className="h-12 bg-white/[0.86] shadow-sm focus:border-emerald focus:ring-emerald/20" />
        </div>
      </div>

      {business.whatsappAvailable && (
        <div className="mt-4 grid gap-3 rounded-lg border border-white bg-[#f8fbff] p-3 text-sm text-slate-700 shadow-sm">
          <label className="flex items-start gap-3">
            <input className="mt-1 size-4 accent-emerald" type="checkbox" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} />
            <span>Send {transactionLower} confirmation and business status updates on WhatsApp. Payment details stay on this website.</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              className="mt-1 size-4 accent-emerald"
              type="checkbox"
              checked={marketingOptIn}
              disabled={!whatsappOptIn}
              onChange={(event) => setMarketingOptIn(event.target.checked)}
            />
            <span>Send me offers and repeat {transactionLower} reminders on WhatsApp.</span>
          </label>
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-lg border border-white bg-[#f8fbff] p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <TicketPercent className="size-4 text-emerald" />
            Coupon
          </p>
          <Badge variant={appliedCoupon ? "emerald" : "neutral"}>{appliedCoupon ? "Applied" : "Optional"}</Badge>
        </div>
        {appliedCoupon ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald/20 bg-emerald/5 p-3">
            <div>
              <p className="text-sm font-bold text-emerald">Coupon discount applied</p>
              {billing.discount > 0 && (
                <p className="mt-1 text-xs font-semibold text-slate-600">You saved {formatINR(billing.discount)} on this {transactionLower}.</p>
              )}
              {couponChecking && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <LoaderCircle className="size-3 animate-spin" />
                  Rechecking discount
                </p>
              )}
            </div>
            <Button type="button" size="sm" variant="secondary" className="bg-white" onClick={removeCoupon}>
              Remove
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              id="couponCode"
              value={couponInput}
              onChange={(event) => setCouponInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void applyCoupon();
              }}
              placeholder="Enter coupon"
              className="h-11 bg-white shadow-sm focus:border-emerald focus:ring-emerald/20"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-11 border-emerald/25 bg-white text-emerald hover:border-emerald/40 hover:bg-emerald/10"
              icon={couponChecking ? <LoaderCircle className="size-4 animate-spin" /> : <TicketPercent className="size-4" />}
              disabled={couponChecking || !cartLines.length}
              onClick={() => void applyCoupon()}
            >
              {couponChecking ? "Checking" : "Apply"}
            </Button>
          </div>
        )}
        {couponNotice && appliedCoupon && !couponChecking && (
          <p className="rounded-lg bg-emerald/5 p-2 text-xs font-semibold text-emerald">{couponNotice}</p>
        )}
        {couponError && (
          <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{couponError}</p>
        )}
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => onlinePaymentAvailable && setPaymentMethod("UPI")}
          disabled={!onlinePaymentAvailable}
          className={cn(
            "flex items-center justify-between rounded-lg border bg-white/[0.72] p-3 text-left shadow-sm transition hover:border-emerald/30 disabled:cursor-not-allowed disabled:opacity-60",
            paymentMethod === "UPI" ? "border-emerald/30 bg-emerald/10" : "border-white"
          )}
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <Wallet className="size-4" />
            Pay online
          </span>
          {paymentMethod === "UPI" && <CheckCircle2 className="size-4 text-emerald" />}
        </button>
        {!onlinePaymentAvailable && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            Automatic online payment is not configured yet.
          </p>
        )}
        {cashPaymentAvailable && (
          <button type="button" onClick={() => setPaymentMethod("PAY_ON_PICKUP_OR_DELIVERY")} className={cn("flex items-center justify-between rounded-lg border bg-white/[0.72] p-3 text-left shadow-sm transition hover:border-ocean/30", paymentMethod === "PAY_ON_PICKUP_OR_DELIVERY" ? "border-ocean/30 bg-ocean/5" : "border-white")}>
            <span className="flex items-center gap-2 text-sm font-bold"><Banknote className="size-4" /> Pay in cash</span>
            {paymentMethod === "PAY_ON_PICKUP_OR_DELIVERY" && <CheckCircle2 className="size-4 text-ocean" />}
          </button>
        )}
        {!onlinePaymentAvailable && !cashPaymentAvailable && (
          <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
            This business has not enabled a payment method yet.
          </p>
        )}
      </div>

      <OrderBillingSummary billing={billing} copy={copy} totalLabel="Total payable" />

      {submitError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <Button type="submit" variant="emerald" className="mt-5 h-12 w-full shadow-[0_18px_44px_rgba(17,166,106,0.28)] hover:bg-[#0f915f]" icon={<TransactionIcon className="size-4" />} disabled={submitDisabled}>
        {submitLabel}
      </Button>
    </form>
  );
}
