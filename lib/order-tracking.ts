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

export const orderTrackingStatuses = ["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERED"] as const;

export type OrderTrackingStatus = (typeof orderTrackingStatuses)[number];

export type OrderTrackingStage = {
  status: OrderTrackingStatus;
  label: string;
  description: string;
};

export type OrderTrackingCopy = {
  transactionLabel: string;
  progressTitle: string;
  completedTitle: string;
  cancelledTitle: string;
  stages: OrderTrackingStage[];
};

function stages(labels: Array<[OrderTrackingStatus, string, string]>): OrderTrackingStage[] {
  return labels.map(([status, label, description]) => ({ status, label, description }));
}

function fallbackStatusLabel(status: string) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getOrderTrackingCopy(businessType: string, orderType: string): OrderTrackingCopy {
  const atCustomerLocation = orderType === "SERVICE_AT_LOCATION";

  if (isCateringBusinessType(businessType)) {
    return {
      transactionLabel: "booking",
      progressTitle: "Your catering journey",
      completedTitle: "Catering completed",
      cancelledTitle: "Catering booking cancelled",
      stages: stages([
        ["NEW", "Booking received", "The catering team has received your event request."],
        ["ACCEPTED", "Event confirmed", "Your catering booking has been confirmed."],
        ["PREPARING", "Preparation in progress", "Food, setup, and event essentials are being prepared."],
        ["READY", atCustomerLocation ? "Ready for event" : "Ready for pickup", atCustomerLocation ? "The team is ready for your event service." : "Your catering package is ready to collect."],
        ["DELIVERED", "Catering completed", "Your catering service has been completed."]
      ])
    };
  }

  if (isFoodBusinessType(businessType)) {
    return {
      transactionLabel: "order",
      progressTitle: "Your order journey",
      completedTitle: orderType === "PICKUP" ? "Order collected" : "Order completed",
      cancelledTitle: "Order cancelled",
      stages: stages([
        ["NEW", "Order received", "The kitchen has received your order."],
        ["ACCEPTED", "Accepted", "The business confirmed your order."],
        ["PREPARING", "Preparing", "Your items are being freshly prepared."],
        ["READY", orderType === "PICKUP" ? "Ready for pickup" : "Ready", orderType === "PICKUP" ? "Your order is packed and ready to collect." : "Your order is prepared and ready."],
        ["DELIVERED", orderType === "PICKUP" ? "Collected" : "Completed", "Your order has been completed. Enjoy!"]
      ])
    };
  }

  if (isRetailBusinessType(businessType)) {
    return {
      transactionLabel: "order",
      progressTitle: "Your order journey",
      completedTitle: "Order completed",
      cancelledTitle: "Order cancelled",
      stages: stages([
        ["NEW", "Order received", "The store has received your order."],
        ["ACCEPTED", "Confirmed", "The store confirmed item availability."],
        ["PREPARING", "Packing", "Your products are being checked and packed."],
        ["READY", "Ready", orderType === "PICKUP" ? "Your order is ready for pickup." : "Your packed order is ready."],
        ["DELIVERED", "Completed", "Your order has been completed."]
      ])
    };
  }

  if (isSalonBusinessType(businessType)) {
    return {
      transactionLabel: "appointment",
      progressTitle: "Your appointment journey",
      completedTitle: "Service completed",
      cancelledTitle: "Appointment cancelled",
      stages: stages([
        ["NEW", "Booking received", "The salon has received your appointment request."],
        ["ACCEPTED", "Appointment confirmed", "Your appointment has been confirmed."],
        ["PREPARING", "Service preparation", "The team is preparing your station and service essentials."],
        ["READY", atCustomerLocation ? "Professional assigned" : "Ready for you", atCustomerLocation ? "Your service professional is ready for the visit." : "The team is ready to begin your service."],
        ["DELIVERED", "Service completed", "Your salon or spa service is complete."]
      ])
    };
  }

  if (isStudioBusinessType(businessType)) {
    return {
      transactionLabel: "booking",
      progressTitle: "Your session journey",
      completedTitle: "Session completed",
      cancelledTitle: "Session cancelled",
      stages: stages([
        ["NEW", "Booking received", "Your class or session request was received."],
        ["ACCEPTED", "Session confirmed", "Your place in the session is confirmed."],
        ["PREPARING", "Session preparation", "The instructor is preparing your session."],
        ["READY", "Ready to start", "Your class or session is ready to begin."],
        ["DELIVERED", "Session completed", "Your class or session is complete."]
      ])
    };
  }

  if (isLaundryBusinessType(businessType)) {
    return {
      transactionLabel: "order",
      progressTitle: "Your laundry journey",
      completedTitle: "Laundry completed",
      cancelledTitle: "Laundry order cancelled",
      stages: stages([
        ["NEW", "Order received", "The laundry has received your request."],
        ["ACCEPTED", "Accepted", "Your laundry order has been confirmed."],
        ["PREPARING", "Processing", "Your items are being cleaned and processed."],
        ["READY", "Ready", "Your finished items are ready."],
        ["DELIVERED", "Completed", "Your laundry order has been completed."]
      ])
    };
  }

  if (isTailoringBusinessType(businessType)) {
    return {
      transactionLabel: "order",
      progressTitle: "Your tailoring journey",
      completedTitle: "Tailoring completed",
      cancelledTitle: "Tailoring order cancelled",
      stages: stages([
        ["NEW", "Order received", "The tailoring team received your request."],
        ["ACCEPTED", "Accepted", "Your requirements have been confirmed."],
        ["PREPARING", "Work in progress", "Cutting, stitching, or alterations are in progress."],
        ["READY", "Ready", "Your finished item is ready."],
        ["DELIVERED", "Completed", "Your tailoring order has been completed."]
      ])
    };
  }

  if (isHomeServiceBusinessType(businessType)) {
    return {
      transactionLabel: "service request",
      progressTitle: "Your service journey",
      completedTitle: "Service completed",
      cancelledTitle: "Service request cancelled",
      stages: stages([
        ["NEW", "Request received", "The service team received your request."],
        ["ACCEPTED", "Professional assigned", "Your request has been accepted and assigned."],
        ["PREPARING", "Service in progress", "The professional is working on your request."],
        ["READY", "Finishing up", "The service is being checked and finalized."],
        ["DELIVERED", "Service completed", "Your service request has been completed."]
      ])
    };
  }

  return {
    transactionLabel: "booking",
    progressTitle: "Your booking journey",
    completedTitle: "Service completed",
    cancelledTitle: "Booking cancelled",
    stages: stages([
      ["NEW", "Booking received", "The business received your booking request."],
      ["ACCEPTED", "Booking confirmed", "Your booking has been confirmed."],
      ["PREPARING", "Service in progress", "The team is working on your service."],
      ["READY", "Ready for you", "The business is ready for you."],
      ["DELIVERED", "Service completed", "Your service has been completed."]
    ])
  };
}

export function getOrderTrackingStatusLabel(businessType: string, orderType: string, status: string) {
  const copy = getOrderTrackingCopy(businessType, orderType);
  if (status === "CANCELLED") return copy.cancelledTitle;
  return copy.stages.find((stage) => stage.status === status)?.label ?? fallbackStatusLabel(status);
}

export function getOrderTrackingStatusActionLabel(businessType: string, orderType: string, status: string) {
  if (status === "CANCELLED") return "Decline";
  return `Mark ${getOrderTrackingStatusLabel(businessType, orderType, status).toLowerCase()}`;
}

export function orderTrackingIndex(status: string) {
  return orderTrackingStatuses.indexOf(status as OrderTrackingStatus);
}
