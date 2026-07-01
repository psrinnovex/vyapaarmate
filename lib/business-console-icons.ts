import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  BriefcaseBusiness,
  CakeSlice,
  CalendarCheck,
  Candy,
  ChefHat,
  ClipboardList,
  Coffee,
  ConciergeBell,
  CupSoda,
  Dumbbell,
  House,
  Hotel,
  Package,
  Pill,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Soup,
  Store,
  UserRoundCheck,
  Users,
  Utensils,
  WashingMachine,
  Wrench
} from "lucide-react";
import {
  isCateringBusinessType,
  isFoodBusinessType,
  isHomeServiceBusinessType,
  isLaundryBusinessType,
  isRetailBusinessType,
  isSalonBusinessType,
  isStudioBusinessType,
  isTailoringBusinessType,
  type ActiveFulfillmentMode
} from "@/lib/business-rules";

export type BusinessConsoleIcons = {
  businessIcon: LucideIcon;
  catalogIcon: LucideIcon;
  categoryIcon: LucideIcon;
  itemIcon: LucideIcon;
  transactionIcon: LucideIcon;
  customerIcon: LucideIcon;
  staffIcon: LucideIcon;
  fulfillmentIcon: LucideIcon;
};

const foodIcons: BusinessConsoleIcons = {
  businessIcon: Utensils,
  catalogIcon: Utensils,
  categoryIcon: Soup,
  itemIcon: Utensils,
  transactionIcon: ShoppingBag,
  customerIcon: Users,
  staffIcon: ChefHat,
  fulfillmentIcon: Store
};

function serviceIcons(overrides: Partial<BusinessConsoleIcons> = {}): BusinessConsoleIcons {
  return {
    businessIcon: BriefcaseBusiness,
    catalogIcon: ClipboardList,
    categoryIcon: Boxes,
    itemIcon: ClipboardList,
    transactionIcon: CalendarCheck,
    customerIcon: UserRoundCheck,
    staffIcon: UserRoundCheck,
    fulfillmentIcon: House,
    ...overrides
  };
}

export function getBusinessConsoleIcons(businessType: string): BusinessConsoleIcons {
  const normalized = businessType.trim().toLowerCase();

  if (isCateringBusinessType(businessType)) {
    return {
      ...foodIcons,
      businessIcon: ConciergeBell,
      catalogIcon: ConciergeBell,
      itemIcon: ConciergeBell,
      transactionIcon: CalendarCheck,
      customerIcon: UserRoundCheck,
      staffIcon: ConciergeBell,
      fulfillmentIcon: House
    };
  }

  if (isFoodBusinessType(businessType)) {
    if (normalized.includes("tiffin")) {
      return { ...foodIcons, businessIcon: Soup, itemIcon: Soup };
    }

    if (normalized.includes("cloud kitchen")) {
      return { ...foodIcons, businessIcon: ChefHat, staffIcon: ChefHat };
    }

    if (normalized.includes("hotel")) {
      return { ...foodIcons, businessIcon: Hotel, fulfillmentIcon: Hotel };
    }

    if (normalized.includes("bakery")) {
      return { ...foodIcons, businessIcon: CakeSlice, itemIcon: CakeSlice };
    }

    if (normalized.includes("cafe")) {
      return { ...foodIcons, businessIcon: Coffee, itemIcon: Coffee };
    }

    if (normalized.includes("juice")) {
      return { ...foodIcons, businessIcon: CupSoda, itemIcon: CupSoda };
    }

    if (normalized.includes("sweets") || normalized.includes("snacks")) {
      return { ...foodIcons, businessIcon: Candy, itemIcon: Candy };
    }

    return foodIcons;
  }

  if (normalized.includes("pharmacy") || normalized.includes("chemist")) {
    return serviceIcons({
      businessIcon: Pill,
      catalogIcon: Pill,
      itemIcon: Pill,
      transactionIcon: ShoppingBag,
      customerIcon: Users,
      fulfillmentIcon: Store
    });
  }

  if (isRetailBusinessType(businessType)) {
    return serviceIcons({
      businessIcon: ShoppingBasket,
      catalogIcon: ShoppingBasket,
      itemIcon: Package,
      transactionIcon: ShoppingBag,
      customerIcon: Users,
      fulfillmentIcon: Store
    });
  }

  if (isStudioBusinessType(businessType)) {
    return serviceIcons({
      businessIcon: Dumbbell,
      catalogIcon: Dumbbell,
      itemIcon: Dumbbell,
      transactionIcon: CalendarCheck,
      customerIcon: Users
    });
  }

  if (isSalonBusinessType(businessType)) {
    return serviceIcons({
      businessIcon: Scissors,
      catalogIcon: Scissors,
      itemIcon: Scissors
    });
  }

  if (isLaundryBusinessType(businessType)) {
    return serviceIcons({
      businessIcon: WashingMachine,
      catalogIcon: WashingMachine,
      itemIcon: Shirt
    });
  }

  if (isTailoringBusinessType(businessType)) {
    return serviceIcons({
      businessIcon: Shirt,
      catalogIcon: Scissors,
      itemIcon: Shirt,
      transactionIcon: ClipboardList
    });
  }

  if (isHomeServiceBusinessType(businessType)) {
    return serviceIcons({
      businessIcon: Wrench,
      catalogIcon: Wrench,
      itemIcon: Wrench
    });
  }

  return serviceIcons();
}

export const fulfillmentModeIcons: Record<ActiveFulfillmentMode, LucideIcon> = {
  PICKUP: ShoppingBag,
  DINE_IN: Store,
  SERVICE_AT_LOCATION: House
};

export function getFulfillmentModeIcon(mode: ActiveFulfillmentMode): LucideIcon {
  return fulfillmentModeIcons[mode];
}
