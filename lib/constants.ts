import {
  BarChart3,
  Bell,
  BrainCircuit,
  CalendarDays,
  CreditCard,
  DatabaseBackup,
  FileClock,
  Home,
  Megaphone,
  MessageCircle,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
  Utensils
} from "lucide-react";
import { subscriptionPlanAmounts, subscriptionSellingPlanAmounts } from "@/lib/billing";
import { launchMarket, launchOffer } from "@/lib/launch-policy";
import { formatINR } from "@/lib/utils";

export { company } from "@/lib/site";

export const featureCards = [
  { title: "Catalog or menu", icon: Utensils, body: "Business-aware catalogs for food, products, services, classes, and availability." },
  { title: "WhatsApp customer updates", icon: MessageCircle, body: "Send confirmations and business status changes on WhatsApp while payment stays on the website." },
  { title: "Online payments", icon: CreditCard, body: "Use Cashfree checkout with automatic payment tracking and UPI fallback support." },
  { title: "Customer CRM", icon: Users, body: "Know repeat buyers, clients, favourites, consent, spend, and last activity." },
  { title: "Repeat reminders", icon: Bell, body: "Send opt-in reminders for meals, appointments, essentials, offers, and subscriptions." },
  { title: "Owner dashboard", icon: BarChart3, body: "Track orders, bookings, sales, pending payments, and top items in real time." },
  { title: "Daily sales summary", icon: ReceiptText, body: "Simple reports that make daily closing and owner follow-up faster." },
  { title: "Staff management", icon: ShieldCheck, body: "Role-based access for owner, manager, kitchen, service, and admin teams." }
];

export const pricingPlans = [
  {
    id: "STARTER",
    name: "Starter",
    price: subscriptionSellingPlanAmounts.STARTER,
    listPrice: subscriptionPlanAmounts.STARTER,
    description: "For home sellers, tiffin providers, solo services, and small single-location stores that need a direct digital ordering base.",
    bestFor: "Low-volume direct orders, bookings, or catalog requests",
    features: [
      "Public business website and catalog",
      "Order or booking alerts",
      "Cashfree checkout and UPI QR payment tracking",
      "WhatsApp customer updates when approved",
      "Basic customer list and invoices"
    ],
    limits: ["Single business location", "Owner-led operations", "Standard onboarding queue"]
  },
  {
    id: "PRO",
    name: "Pro",
    price: subscriptionSellingPlanAmounts.PRO,
    listPrice: subscriptionPlanAmounts.PRO,
    description: "For growing restaurants, kitchens, salons, retailers, pharmacies, and service teams that need repeat sales and staff workflows.",
    bestFor: "Daily operations with staff, CRM, campaigns, and reporting",
    features: [
      "Everything in Starter",
      "CRM and repeat reminders",
      "Staff roles for operations teams",
      "Saved campaign drafts (delivery not enabled)",
      "Advanced sales and booking reports",
      "Priority setup and support"
    ],
    limits: ["Recommended for active daily operations", "Best for teams using dashboard + WhatsApp together", "Priority onboarding queue"]
  }
] as const;

export const pricingPolicy = {
  setupFeeRange: `${formatINR(launchOffer.standardSetupFeeMinimum)} to ${formatINR(launchOffer.standardSetupFeeMaximum)}`,
  standardSetupFeeRange: `${formatINR(launchOffer.standardSetupFeeMinimum)} to ${formatINR(launchOffer.standardSetupFeeMaximum)}`,
  launchOfferLabel: launchOffer.discountLabel,
  launchMarketLabel: launchMarket.displayName,
  passThroughLabel: "Payment gateway and WhatsApp message charges are pass-through usage costs.",
  recommendation: launchOffer.publiclyAdvertised
    ? `${launchMarket.displayName} launch pricing is Starter at ${formatINR(subscriptionSellingPlanAmounts.STARTER)}/month and Pro at ${formatINR(subscriptionSellingPlanAmounts.PRO)}/month before GST, about ${launchOffer.discountPercent}% below the standard subscription prices.`
    : `Starter is ${formatINR(subscriptionPlanAmounts.STARTER)}/month and Pro is ${formatINR(subscriptionPlanAmounts.PRO)}/month. Charge setup separately based on catalog size, WhatsApp template work, payment setup, and onboarding effort.`
} as const;

export const dashboardNav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/ai-suggestions", label: "AI Suggestions", icon: BrainCircuit },
  { href: "/dashboard/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/orders/history", label: "Order History", icon: ReceiptText },
  { href: "/dashboard/menu", label: "Menu", icon: Utensils },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/dashboard/billing", label: "Subscription", icon: FileClock },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/staff", label: "Staff", icon: ShieldCheck },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export const adminNav = [
  { href: "/admin/pilot", label: "Pilot Evidence", icon: BarChart3 },
  { href: "/admin", label: "Platform", icon: Home },
  { href: "/admin/businesses", label: "Businesses", icon: Store },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: FileClock },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/support", label: "Support", icon: MessageCircle },
  { href: "/admin/logs", label: "Logs", icon: ReceiptText },
  { href: "/admin/account-retention", label: "Data retention", icon: DatabaseBackup },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];
