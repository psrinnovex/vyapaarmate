import type { ActiveFulfillmentMode } from "@/lib/business-rules";

export type DemoMenuItem = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  foodType: "VEG" | "NON_VEG" | "EGG" | "NOT_APPLICABLE";
  imageUrl: string | null;
  isAvailable: boolean;
  isBestSeller?: boolean;
};

export type DemoBusiness = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  businessType: string;
  logoText: string;
  logoUrl?: string | null;
  isApproved: boolean;
  open: boolean;
  hours: string;
  minimumOrder: number;
  deliveryFee: number;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number;
  fulfillmentModes: ActiveFulfillmentMode[];
  allowsPayOnDelivery: boolean;
  onlinePaymentAvailable: boolean;
  whatsappAvailable: boolean;
  orderGstRateBps?: number;
  coupons?: Array<{
    code: string;
    description: string | null;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    minimumOrderAmount: number;
  }>;
  menu: DemoMenuItem[];
};

export const demoBusinesses: DemoBusiness[] = [
  {
    id: "biz_1",
    name: "Sri Sai Tiffins",
    slug: "sri-sai-tiffins",
    ownerName: "Srinivas Rao",
    phone: "+91 98765 43210",
    email: "orders@srisaitiffins.in",
    address: "12 MG Road, Vijayawada",
    city: "Vijayawada",
    state: "Andhra Pradesh",
    businessType: "Tiffin Center",
    logoText: "SS",
    isApproved: true,
    open: true,
    hours: "7:00 AM - 10:30 PM",
    minimumOrder: 99,
    deliveryFee: 0,
    latitude: 16.5062,
    longitude: 80.6480,
    serviceRadiusKm: 0,
    fulfillmentModes: ["PICKUP", "DINE_IN"],
    allowsPayOnDelivery: true,
    onlinePaymentAvailable: true,
    whatsappAvailable: true,
    menu: [
      {
        id: "item_1",
        category: "Breakfast",
        name: "Ghee Idli Combo",
        description: "Three soft idlis with ghee, podi, sambar, and coconut chutney.",
        price: 89,
        foodType: "VEG",
        imageUrl: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=900&q=80",
        isAvailable: true,
        isBestSeller: true
      },
      {
        id: "item_2",
        category: "Breakfast",
        name: "Masala Dosa",
        description: "Crisp dosa with potato masala and three chutneys.",
        price: 119,
        foodType: "VEG",
        imageUrl: "https://images.unsplash.com/photo-1694849789325-914b71ab4075?auto=format&fit=crop&w=900&q=80",
        isAvailable: true,
        isBestSeller: true
      },
      {
        id: "item_3",
        category: "Meals",
        name: "Mini Meals",
        description: "Rice, dal, curry, curd, papad, and pickle.",
        price: 149,
        foodType: "VEG",
        imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80",
        isAvailable: true
      },
      {
        id: "item_4",
        category: "Snacks",
        name: "Punugulu Plate",
        description: "Crispy evening snack with ginger chutney.",
        price: 79,
        foodType: "VEG",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
        isAvailable: true
      }
    ]
  },
  {
    id: "biz_2",
    name: "Fresh Bowl Cloud Kitchen",
    slug: "fresh-bowl-cloud-kitchen",
    ownerName: "Ananya Sharma",
    phone: "+91 98123 40987",
    email: "hello@freshbowl.in",
    address: "HSR Layout, Bengaluru",
    city: "Bengaluru",
    state: "Karnataka",
    businessType: "Cloud Kitchen",
    logoText: "FB",
    isApproved: true,
    open: true,
    hours: "11:00 AM - 11:00 PM",
    minimumOrder: 199,
    deliveryFee: 0,
    latitude: 12.9116,
    longitude: 77.6389,
    serviceRadiusKm: 0,
    fulfillmentModes: ["PICKUP"],
    allowsPayOnDelivery: false,
    onlinePaymentAvailable: true,
    whatsappAvailable: true,
    menu: [
      {
        id: "item_5",
        category: "Signature Bowls",
        name: "Paneer Protein Bowl",
        description: "Paneer tikka, millet rice, salad, mint dressing.",
        price: 249,
        foodType: "VEG",
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
        isAvailable: true,
        isBestSeller: true
      },
      {
        id: "item_6",
        category: "Signature Bowls",
        name: "Chicken Teriyaki Bowl",
        description: "Grilled chicken, herbed rice, greens, teriyaki sauce.",
        price: 289,
        foodType: "NON_VEG",
        imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
        isAvailable: true
      }
    ]
  },
  {
    id: "biz_3",
    name: "Sweet Cravings Home Bakery",
    slug: "sweet-cravings-home-bakery",
    ownerName: "Meera Kapoor",
    phone: "+91 99001 12233",
    email: "cakes@sweetcravings.in",
    address: "Sector 45, Gurugram",
    city: "Gurugram",
    state: "Haryana",
    businessType: "Home Bakery",
    logoText: "SC",
    isApproved: true,
    open: false,
    hours: "10:00 AM - 8:00 PM",
    minimumOrder: 299,
    deliveryFee: 0,
    latitude: 28.4517,
    longitude: 77.0700,
    serviceRadiusKm: 0,
    fulfillmentModes: ["PICKUP"],
    allowsPayOnDelivery: true,
    onlinePaymentAvailable: true,
    whatsappAvailable: false,
    menu: [
      {
        id: "item_7",
        category: "Cakes",
        name: "Belgian Chocolate Bento Cake",
        description: "Small-batch chocolate cake with ganache frosting.",
        price: 399,
        foodType: "EGG",
        imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
        isAvailable: true,
        isBestSeller: true
      },
      {
        id: "item_8",
        category: "Cupcakes",
        name: "Assorted Cupcake Box",
        description: "Six cupcakes with chocolate, vanilla, and strawberry frosting.",
        price: 549,
        foodType: "EGG",
        imageUrl: "https://images.unsplash.com/photo-1586094320145-49e6e4f40f57?auto=format&fit=crop&w=900&q=80",
        isAvailable: true
      }
    ]
  }
];

export const demoOrders = [
  { id: "VM-1008", customer: "Rahul Verma", items: "Ghee Idli Combo x2", amount: 198, status: "NEW", paymentStatus: "PENDING", channel: "WhatsApp", time: "4 min ago" },
  { id: "VM-1007", customer: "Priya Nair", items: "Mini Meals x1", amount: 169, status: "PREPARING", paymentStatus: "COMPLETED", channel: "Direct Link", time: "18 min ago" },
  { id: "VM-1006", customer: "Aman Gupta", items: "Masala Dosa x2", amount: 258, status: "READY", paymentStatus: "COMPLETED", channel: "WhatsApp", time: "42 min ago" },
  { id: "VM-1005", customer: "Neha Shah", items: "Punugulu Plate x3", amount: 257, status: "DELIVERED", paymentStatus: "COMPLETED", channel: "Direct Link", time: "1 hr ago" }
];

export const demoCustomers = [
  { name: "Rahul Verma", phone: "+91 97000 01111", totalOrders: 8, totalSpent: 2840, lastOrdered: "Today", favouriteItems: "Ghee Idli Combo", whatsappOptIn: true, marketingOptIn: true },
  { name: "Priya Nair", phone: "+91 97000 02222", totalOrders: 5, totalSpent: 1375, lastOrdered: "Yesterday", favouriteItems: "Mini Meals", whatsappOptIn: true, marketingOptIn: false },
  { name: "Aman Gupta", phone: "+91 97000 03333", totalOrders: 11, totalSpent: 4210, lastOrdered: "2 days ago", favouriteItems: "Masala Dosa", whatsappOptIn: true, marketingOptIn: true },
  { name: "Neha Shah", phone: "+91 97000 04444", totalOrders: 3, totalSpent: 780, lastOrdered: "5 days ago", favouriteItems: "Punugulu Plate", whatsappOptIn: false, marketingOptIn: false }
];

export const demoPayments = [
  { orderId: "VM-1007", customer: "Priya Nair", amount: 169, provider: "Cashfree", paymentId: "cf_demo_1007", status: "COMPLETED", linkStatus: "paid", refundStatus: "none" },
  { orderId: "VM-1008", customer: "Rahul Verma", amount: 198, provider: "UPI", paymentId: "qr_demo_1008", status: "PENDING", linkStatus: "website QR ready", refundStatus: "none" },
  { orderId: "VM-1005", customer: "Neha Shah", amount: 257, provider: "Cashfree", paymentId: "cf_demo_1005", status: "COMPLETED", linkStatus: "paid", refundStatus: "none" }
];

export const demoStaff = [
  { name: "Srinivas Rao", role: "Owner", permissions: "Full access", status: "Active" },
  { name: "Lakshmi P", role: "Manager", permissions: "Orders, menu, customers, payments, reports", status: "Active" },
  { name: "Ravi K", role: "Kitchen Staff", permissions: "Orders and kitchen status updates", status: "Active" },
  { name: "Mahesh D", role: "Delivery Staff", permissions: "Order delivery status updates", status: "Invited" }
];

export const platformBusinesses = [
  { name: "Sri Sai Tiffins", phone: "+91 98765 43210", city: "Vijayawada", plan: "Pro", status: "Active", revenue: 84200, orders: 1240, kyc: "Verified" },
  { name: "Fresh Bowl Cloud Kitchen", phone: "+91 98123 40987", city: "Bengaluru", plan: "Pro", status: "Active", revenue: 182500, orders: 2110, kyc: "Verified" },
  { name: "Sweet Cravings Home Bakery", phone: "+91 99001 12233", city: "Gurugram", plan: "Starter", status: "Trial", revenue: 22600, orders: 185, kyc: "Pending" },
  { name: "Green Sip Juice Bar", phone: "+91 90011 22334", city: "Hyderabad", plan: "Starter", status: "Inactive", revenue: 8100, orders: 74, kyc: "Pending" }
];

export const demoBusinessIds = new Set(demoBusinesses.map((business) => business.id));
export const demoBusinessSlugs = new Set(demoBusinesses.map((business) => business.slug));

export function findDemoBusinessBySlug(slug: string) {
  return demoBusinesses.find((business) => business.slug === slug);
}

export function isDemoBusinessId(id: string) {
  return demoBusinessIds.has(id);
}

export function isDemoBusinessSlug(slug: string) {
  return demoBusinessSlugs.has(slug);
}

export function shouldExposePublicDemoBusinesses() {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_EXPOSE_PUBLIC_DEMO_BUSINESSES === "true";
}

export function getBusinessBySlug(slug: string) {
  return findDemoBusinessBySlug(slug) ?? demoBusinesses[0];
}

export function categoriesForBusiness(business: DemoBusiness) {
  return Array.from(new Set(business.menu.map((item) => item.category)));
}
