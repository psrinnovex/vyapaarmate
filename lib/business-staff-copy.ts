import {
  isCateringBusinessType,
  isFoodBusinessType,
  isHomeServiceBusinessType,
  isLaundryBusinessType,
  isRetailBusinessType,
  isSalonBusinessType,
  isStudioBusinessType,
  isTailoringBusinessType
} from "@/lib/business-rules";
import { getBusinessConsoleCopy } from "@/lib/business-console-copy";

const baseRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SUPPORT_AGENT: "Support Agent",
  OWNER: "Owner",
  CUSTOMER: "Customer",
  MANAGER: "Manager"
};

export function getBusinessStaffRoleLabel(role: string, businessType = "") {
  if (baseRoleLabels[role]) return baseRoleLabels[role];

  if (role === "KITCHEN_STAFF") {
    if (isCateringBusinessType(businessType)) return "Catering Staff";
    if (isFoodBusinessType(businessType)) return "Kitchen Staff";
    if (isRetailBusinessType(businessType)) return "Store Staff";
    if (isSalonBusinessType(businessType)) return "Salon Staff";
    if (isStudioBusinessType(businessType)) return "Session Staff";
    if (isLaundryBusinessType(businessType)) return "Laundry Staff";
    if (isTailoringBusinessType(businessType)) return "Tailoring Staff";
    if (isHomeServiceBusinessType(businessType)) return "Field Staff";
    return "Operations Staff";
  }

  if (role === "DELIVERY_STAFF") {
    if (isCateringBusinessType(businessType)) return "Event Staff";
    if (isFoodBusinessType(businessType) || isRetailBusinessType(businessType)) return "Delivery Staff";
    if (isLaundryBusinessType(businessType)) return "Pickup Staff";
    if (isTailoringBusinessType(businessType) || isHomeServiceBusinessType(businessType)) return "Field Staff";
    return "Service Staff";
  }

  return "Staff";
}

export function getBusinessStaffPermissionSummary(role: string, businessType = "") {
  const copy = getBusinessConsoleCopy(businessType);
  const catalog = copy.catalogNavLabel.toLowerCase();
  const customers = copy.customerPlural.toLowerCase();

  if (role === "OWNER") return "Full access";
  if (role === "CUSTOMER") return "User portal access";

  if (role === "MANAGER") {
    return `${copy.transactionPlural}, ${catalog}, ${customers}, payments, reports`;
  }

  if (role === "KITCHEN_STAFF") {
    if (isCateringBusinessType(businessType)) return `${copy.transactionPlural} and event preparation updates`;
    if (isFoodBusinessType(businessType)) return "Orders and kitchen status updates";
    if (isRetailBusinessType(businessType)) return `${copy.transactionPlural} and packing status updates`;
    if (isSalonBusinessType(businessType)) return "Appointments and service progress updates";
    if (isStudioBusinessType(businessType)) return "Bookings and session status updates";
    if (isLaundryBusinessType(businessType)) return `${copy.transactionPlural} and laundry status updates`;
    if (isTailoringBusinessType(businessType)) return `${copy.transactionPlural} and tailoring status updates`;
    if (isHomeServiceBusinessType(businessType)) return "Service requests and field status updates";
    return `${copy.transactionPlural} and service status updates`;
  }

  if (role === "DELIVERY_STAFF") {
    if (isCateringBusinessType(businessType)) return "Event booking status updates";
    if (isFoodBusinessType(businessType) || isRetailBusinessType(businessType)) {
      return `${copy.transactionSingular} delivery status updates`;
    }
    if (isSalonBusinessType(businessType)) return "Appointment status updates";
    if (isStudioBusinessType(businessType)) return "Session status updates";
    if (isLaundryBusinessType(businessType)) return "Pickup and delivery status updates";
    if (isTailoringBusinessType(businessType) || isHomeServiceBusinessType(businessType)) {
      return `${copy.transactionSingular} field status updates`;
    }
    return `${copy.transactionSingular} status updates`;
  }

  if (role === "SUPER_ADMIN" || role === "SUPPORT_AGENT") return "Platform access";

  return `${copy.transactionPlural} dashboard access`;
}
