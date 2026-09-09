import { z } from "zod";
import { isLaunchCity, isLaunchState, launchBusinessLocationError, launchMarket } from "@/lib/launch-policy";
import { isValidGstin, normalizeGstin } from "@/lib/gstin";
import { kycAllowedContentTypes, kycDocumentTypes, kycMaxDocumentBytes } from "@/lib/kyc";
import { normalizePhoneForStorage, parsePhoneNumber } from "@/lib/phone";

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return value;
  return value.trim().toLowerCase();
}

const emailSchema = z.preprocess(normalizeEmail, z.string().email("Enter a valid email address"));
const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  emailSchema.optional()
);
const optionalNumberSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().optional()
);
const latitudeSchema = optionalNumberSchema.refine(
  (value) => value === undefined || (value >= -90 && value <= 90),
  "Latitude must be between -90 and 90"
);
const longitudeSchema = optionalNumberSchema.refine(
  (value) => value === undefined || (value >= -180 && value <= 180),
  "Longitude must be between -180 and 180"
);
const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );
const orderFulfillmentModeSchema = z.enum(["PICKUP", "DINE_IN", "SERVICE_AT_LOCATION"]);
const optionalIsoDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().datetime().optional()
);
const optionalIntegerSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive().optional()
);
const couponCodeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : value),
  z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/, "Use 2-32 letters, numbers, hyphens, or underscores")
);
const optionalCouponCodeSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  couponCodeSchema.optional()
);
const optionalGstinSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = normalizeGstin(value);
    return normalized === "" ? undefined : normalized;
  },
  z
    .string()
    .refine(isValidGstin, "Enter a valid GSTIN with the correct check digit")
    .optional()
);
const requiredLatitudeSchema = z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90");
const requiredLongitudeSchema = z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180");
const upiIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9._-]{2,64}$/, "Enter a valid UPI ID like business@bank")
    .optional()
);
const bankAccountNumberSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().regex(/^\d{6,30}$/, "Enter only the bank account number digits").optional()
);
const bankIfscSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code")
    .optional()
);
const payoutDestinationShape = {
  payoutMethod: z.enum(["UPI", "BANK_TRANSFER"]),
  payoutAccountHolderName: z.string().trim().min(2, "Enter the account holder name").max(120),
  payoutUpiId: upiIdSchema,
  payoutUpiName: optionalTrimmedString(120),
  payoutBankName: optionalTrimmedString(120),
  payoutBankAccountNumber: bankAccountNumberSchema,
  payoutBankIfsc: bankIfscSchema
};

type PayoutDestinationInput = {
  payoutMethod: "UPI" | "BANK_TRANSFER";
  payoutAccountHolderName?: string;
  payoutUpiId?: string;
  payoutBankName?: string;
  payoutBankAccountNumber?: string;
  payoutBankIfsc?: string;
};

function validatePayoutDestination(data: PayoutDestinationInput, context: z.RefinementCtx) {
  if (data.payoutMethod === "UPI" && !data.payoutUpiId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter the UPI ID that should receive wallet payouts.",
      path: ["payoutUpiId"]
    });
  }

  if (data.payoutMethod === "BANK_TRANSFER") {
    if (!data.payoutBankName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the bank name.",
        path: ["payoutBankName"]
      });
    }
    if (!data.payoutBankAccountNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the bank account number.",
        path: ["payoutBankAccountNumber"]
      });
    }
    if (!data.payoutBankIfsc) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the bank IFSC code.",
        path: ["payoutBankIfsc"]
      });
    }
  }
}

export const phoneSchema = z.preprocess(
  (value) => normalizePhoneForStorage(value),
  z.string().refine((value) => parsePhoneNumber(value).isValid, "Enter a valid mobile number")
);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8)
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  portal: z.enum(["admin", "support", "business", "user"]).optional()
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Open the password reset link from your email again."),
  password: z.string().min(10, "Password must be at least 10 characters.")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  password: z.string().min(10, "Password must be at least 10 characters.")
});

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  businessName: z.string().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(10),
  businessType: z.string().min(2).max(80),
  city: z
    .string()
    .trim()
    .min(2, "Select the launch city")
    .max(80)
    .refine(isLaunchCity, `Business onboarding is currently limited to ${launchMarket.displayName}.`),
  state: z
    .string()
    .trim()
    .min(2, "Enter the business state")
    .max(80)
    .refine(isLaunchState, `Business onboarding is currently limited to ${launchMarket.displayName}.`),
  subscriptionPlan: z.enum(["STARTER", "PRO"]).default("STARTER"),
  whatsappEnabled: z.boolean().default(true)
}).superRefine((value, ctx) => {
  const error = launchBusinessLocationError(value);
  if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: error });
});

export const userRegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(10, "Password must be at least 10 characters.")
});

export const registrationVerificationSchema = z.object({
  registrationId: z.string().min(1),
  emailCode: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit email code"),
  smsCode: z.string().trim().regex(/^\d{4,10}$/, "Enter the SMS verification code").optional()
});

export const registrationResendSchema = z.object({
  registrationId: z.string().min(1)
});

export const orderSubmissionSchema = z.object({
  businessSlug: z.string().min(2),
  customer: z.object({
    name: z.string().min(2).max(80),
    email: optionalEmailSchema,
    phone: phoneSchema,
    address: z.string().max(300).optional(),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    whatsappOptIn: z.boolean(),
    marketingOptIn: z.boolean()
  }),
  orderType: orderFulfillmentModeSchema,
  scheduledFor: optionalIsoDateSchema,
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(["UPI", "PAY_ON_PICKUP_OR_DELIVERY"]),
  couponCode: optionalCouponCodeSchema,
  appointment: z
    .object({
      providerId: z.string().trim().min(1).max(120),
      startsAt: z.string().datetime({ offset: true })
    })
    .optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(99)
      })
    )
    .min(1)
});

export const appointmentAvailabilitySchema = z.object({
  businessSlug: z.string().trim().min(2).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid appointment date."),
  providerId: z.string().trim().min(1).max(120).optional(),
  orderType: orderFulfillmentModeSchema,
  items: z
    .array(
      z.object({
        menuItemId: z.string().trim().min(1).max(120),
        quantity: z.number().int().min(1).max(20)
      })
    )
    .min(1)
    .max(20)
});

const appointmentProviderShape = {
  name: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(80),
  bio: optionalTrimmedString(500),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Choose a valid provider color."),
  isActive: z.boolean(),
  acceptsAtBusiness: z.boolean(),
  acceptsAtCustomerLocation: z.boolean(),
  serviceIds: z.array(z.string().trim().min(1).max(120)).max(200)
};

function validateAppointmentProviderLocations(
  data: { acceptsAtBusiness: boolean; acceptsAtCustomerLocation: boolean },
  context: z.RefinementCtx
) {
  if (!data.acceptsAtBusiness && !data.acceptsAtCustomerLocation) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["acceptsAtBusiness"],
      message: "Enable at least one appointment location."
    });
  }
}

const appointmentSettingsActionSchema = z.object({
  action: z.literal("settings.update"),
  enabled: z.boolean(),
  autoConfirm: z.boolean(),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120),
  leadTimeMinutes: z.coerce.number().int().min(0).max(10080),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancellationNoticeMinutes: z.coerce.number().int().min(0).max(43200)
});

const appointmentProviderCreateActionSchema = z
  .object({
    action: z.literal("provider.create"),
    ...appointmentProviderShape
  })
  .superRefine(validateAppointmentProviderLocations);

const appointmentProviderUpdateActionSchema = z
  .object({
    action: z.literal("provider.update"),
    providerId: z.string().trim().min(1).max(120),
    ...appointmentProviderShape
  })
  .superRefine(validateAppointmentProviderLocations);

const appointmentAvailabilityActionSchema = z.object({
  action: z.literal("availability.save"),
  providerId: z.string().trim().min(1).max(120),
  rules: z
    .array(
      z
        .object({
          weekday: z.coerce.number().int().min(0).max(6),
          startMinute: z.coerce.number().int().min(0).max(1439),
          endMinute: z.coerce.number().int().min(1).max(1440)
        })
        .refine((rule) => rule.endMinute > rule.startMinute, "End time must be after start time.")
    )
    .max(28)
});

const appointmentTimeOffCreateActionSchema = z
  .object({
    action: z.literal("timeoff.create"),
    providerId: z.string().trim().min(1).max(120).nullable(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: optionalTrimmedString(200)
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    path: ["endsAt"],
    message: "End time must be after start time."
  });

const appointmentTimeOffDeleteActionSchema = z.object({
  action: z.literal("timeoff.delete"),
  timeOffId: z.string().trim().min(1).max(120)
});

const appointmentStatusActionSchema = z.object({
  action: z.literal("appointment.status"),
  appointmentId: z.string().trim().min(1).max(120),
  status: z.enum(["REQUESTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  cancellationReason: optionalTrimmedString(240)
});

const appointmentRescheduleActionSchema = z.object({
  action: z.literal("appointment.reschedule"),
  appointmentId: z.string().trim().min(1).max(120),
  providerId: z.string().trim().min(1).max(120),
  startsAt: z.string().datetime({ offset: true })
});

const appointmentCreateActionSchema = z.object({
  action: z.literal("appointment.create"),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: phoneSchema,
    email: optionalEmailSchema,
    address: optionalTrimmedString(300),
    whatsappOptIn: z.boolean().default(false)
  }),
  providerId: z.string().trim().min(1).max(120),
  startsAt: z.string().datetime({ offset: true }),
  orderType: orderFulfillmentModeSchema,
  notes: optionalTrimmedString(500),
  items: z
    .array(
      z.object({
        menuItemId: z.string().trim().min(1).max(120),
        quantity: z.coerce.number().int().min(1).max(20)
      })
    )
    .min(1)
    .max(20)
}).superRefine((data, context) => {
  if (data.orderType === "SERVICE_AT_LOCATION" && !data.customer.address) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customer", "address"],
      message: "Add the customer service address."
    });
  }
});

export const appointmentDashboardActionSchema = z.union([
  appointmentSettingsActionSchema,
  appointmentProviderCreateActionSchema,
  appointmentProviderUpdateActionSchema,
  appointmentAvailabilityActionSchema,
  appointmentTimeOffCreateActionSchema,
  appointmentTimeOffDeleteActionSchema,
  appointmentStatusActionSchema,
  appointmentRescheduleActionSchema,
  appointmentCreateActionSchema
]);

export const orderStatusSchema = z
  .object({
    status: z.enum(["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "CANCELLED"]),
    outcome: z.enum(["NO_SHOW"]).optional(),
    reason: optionalTrimmedString(240)
  })
  .superRefine((data, context) => {
    if (data.outcome === "NO_SHOW" && data.status !== "CANCELLED") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A no-show must close the appointment as cancelled.",
        path: ["status"]
      });
    }
  });

export const cashPaymentStatusSchema = z.object({
  status: z.literal("COMPLETED")
});

export const menuCategorySchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const menuItemSchema = z
  .object({
    categoryId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(500),
    price: z.coerce.number().min(0).max(999999),
    foodType: z.enum(["VEG", "NON_VEG", "EGG", "NOT_APPLICABLE"]),
    isAvailable: z.boolean(),
    isBestSeller: z.boolean(),
    appointmentEnabled: z.boolean().default(false),
    durationMinutes: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().min(5).max(1440).optional()
    ),
    bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
    imageDataUrl: z.string().max(700_000).nullable().optional()
  })
  .superRefine((data, context) => {
    if (data.appointmentEnabled && !data.durationMinutes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationMinutes"],
        message: "Set the service duration before enabling appointment booking."
      });
    }
  });

const businessImageDataUrlSchema = z.string().max(500_000).nullable().optional();

export const staffInviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  role: z.enum(["MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"])
});

export const adminSupportAgentInviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal(""))
});

export const adminSupportAgentUpdateSchema = adminSupportAgentInviteSchema;

export const staffRoleUpdateSchema = z.object({
  role: z.enum(["MANAGER", "KITCHEN_STAFF", "DELIVERY_STAFF"])
});

export const adminBusinessActionSchema = z.object({
  action: z.enum(["approve", "reject", "unapprove", "suspend", "open", "close"])
});

export const adminBusinessServiceAreaSchema = z
  .object({
    action: z.literal("serviceArea"),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    serviceRadiusKm: z.coerce.number().min(0).max(500),
    serviceVisitFee: z.coerce.number().min(0).max(999999),
    acceptsPickup: z.boolean(),
    acceptsDineIn: z.boolean(),
    acceptsServiceAtLocation: z.boolean()
  })
  .superRefine((data, context) => {
    if (!data.acceptsPickup && !data.acceptsDineIn && !data.acceptsServiceAtLocation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enable at least one fulfillment option.",
        path: ["acceptsPickup"]
      });
    }

    if (data.acceptsServiceAtLocation) {
      if (data.latitude === undefined || data.longitude === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Set the business location pin before enabling service at customer location.",
          path: ["latitude"]
        });
      }
      if (data.serviceRadiusKm <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Service radius must be greater than 0 km.",
          path: ["serviceRadiusKm"]
        });
      }
    }
  });

export const adminBusinessWhatsappSchema = z.object({
  action: z.enum(["approveWhatsapp", "disableWhatsapp"])
});

export const adminBusinessWhatsappSetupSchema = z.object({
  action: z.literal("whatsappSetup"),
  whatsappDisplayPhone: phoneSchema.optional().or(z.literal("")),
  whatsappPhoneNumberId: optionalTrimmedString(80),
  whatsappWabaId: optionalTrimmedString(80),
  whatsappAccessToken: optionalTrimmedString(5000)
});

export const adminBusinessPayoutSetupSchema = z.object({
  action: z.literal("payoutSetup"),
  platformFeeBps: z.coerce.number().int().min(0).max(5000)
});

export const adminBusinessPatchSchema = z.union([
  adminBusinessActionSchema,
  adminBusinessServiceAreaSchema,
  adminBusinessWhatsappSchema,
  adminBusinessWhatsappSetupSchema,
  adminBusinessPayoutSetupSchema
]);

export const dashboardSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    ownerName: z.string().trim().min(2).max(80),
    businessType: z.string().trim().min(2).max(80),
    email: emailSchema,
    phone: phoneSchema,
    address: z.string().trim().min(5, "Enter the full business address").max(300),
    city: z.string().trim().min(2, "Enter the city").max(80),
    state: z.string().trim().min(2, "Enter the state").max(80),
    businessHours: z.string().trim().min(2).max(500),
    isOpen: z.boolean(),
    minimumOrder: z.coerce.number().min(0).max(999999),
    deliveryFee: z.coerce.number().min(0).max(999999),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    serviceRadiusKm: z.coerce.number().min(0).max(500),
    acceptsPickup: z.boolean(),
    acceptsDineIn: z.boolean(),
    acceptsServiceAtLocation: z.boolean(),
    allowsPayLater: z.boolean(),
    logoImageDataUrl: businessImageDataUrlSchema,
    whatsappEnabled: z.boolean(),
    whatsappDisplayPhone: phoneSchema.optional().or(z.literal("")),
    ...payoutDestinationShape
  })
  .superRefine((data, context) => {
    const marketError = launchBusinessLocationError(data, { requireCoordinates: true });
    if (marketError) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: marketError, path: ["city"] });
    }

    if (!data.acceptsPickup && !data.acceptsDineIn && !data.acceptsServiceAtLocation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enable at least one fulfillment option.",
        path: ["acceptsPickup"]
      });
    }

    if (data.acceptsServiceAtLocation) {
      if (data.latitude === undefined || data.longitude === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Set the business location pin before enabling service at customer location.",
          path: ["latitude"]
        });
      }
      if (data.serviceRadiusKm <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Service radius must be greater than 0 km.",
          path: ["serviceRadiusKm"]
        });
      }
    }

    validatePayoutDestination(data, context);
  });

export const dashboardBusinessAddressSchema = z
  .object({
    address: z.string().trim().min(5, "Enter the full business address").max(300),
    city: z.string().trim().min(2, "Enter the city").max(80),
    state: z.string().trim().min(2, "Enter the state").max(80)
  })
  .superRefine((data, context) => {
    const marketError = launchBusinessLocationError(data);
    if (marketError) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: marketError, path: ["city"] });
    }
  });

export const businessSetupSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    ownerName: z.string().trim().min(2).max(80),
    businessType: z.string().trim().min(2).max(80),
    email: emailSchema,
    phone: phoneSchema,
    address: z.string().trim().min(5, "Enter the full business address").max(300),
    city: z.string().trim().min(2, "Enter the city").max(80),
    state: z.string().trim().min(2, "Enter the state").max(80),
    businessHours: z.string().trim().min(2).max(500),
    isOpen: z.boolean(),
    minimumOrder: z.coerce.number().min(0).max(999999),
    deliveryFee: z.coerce.number().min(0).max(999999),
    latitude: requiredLatitudeSchema,
    longitude: requiredLongitudeSchema,
    serviceRadiusKm: z.coerce.number().min(0).max(500),
    acceptsPickup: z.boolean(),
    acceptsDineIn: z.boolean(),
    acceptsServiceAtLocation: z.boolean(),
    allowsPayLater: z.boolean(),
    logoImageDataUrl: businessImageDataUrlSchema,
    whatsappEnabled: z.boolean(),
    whatsappDisplayPhone: phoneSchema.optional().or(z.literal("")),
    ...payoutDestinationShape
  })
  .superRefine((data, context) => {
    const marketError = launchBusinessLocationError(data, { requireCoordinates: true });
    if (marketError) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: marketError, path: ["city"] });
    }

    if (!data.acceptsPickup && !data.acceptsDineIn && !data.acceptsServiceAtLocation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enable at least one fulfillment option.",
        path: ["acceptsPickup"]
      });
    }

    if (data.acceptsServiceAtLocation && data.serviceRadiusKm <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Service radius must be greater than 0 km.",
        path: ["serviceRadiusKm"]
      });
    }

    validatePayoutDestination(data, context);
  });

export const adminPlatformPaymentSettingsSchema = z
  .object({
    directUpiEnabled: z.boolean(),
    upiId: upiIdSchema,
    upiName: z.string().trim().min(2).max(80)
  })
  .superRefine((data, context) => {
    if (data.directUpiEnabled && !data.upiId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the PSHR Innovex UPI ID before enabling direct UPI collection.",
        path: ["upiId"]
      });
    }
  });

export const adminPlatformUpiVerificationSchema = z.object({
  status: z.literal("COMPLETED"),
  reference: z.string().trim().min(4).max(120)
});

export const billingCheckoutSchema = z.object({
  plan: z.enum(["STARTER", "PRO"]),
  couponCode: optionalCouponCodeSchema,
  billingGstin: optionalGstinSchema
});

export const billingCheckoutPreviewSchema = billingCheckoutSchema;

export const orderCouponPreviewSchema = z.object({
  businessSlug: z.string().min(2),
  couponCode: couponCodeSchema,
  subtotal: z.coerce.number().min(0).max(999999),
  serviceFee: z.coerce.number().min(0).max(999999),
  orderType: orderFulfillmentModeSchema.optional()
});

export const kycDocumentUploadSchema = z.object({
  type: z.enum(kycDocumentTypes),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(kycAllowedContentTypes),
  fileSize: z.coerce.number().int().min(1).max(kycMaxDocumentBytes),
  dataUrl: z.string().max(Math.ceil(kycMaxDocumentBytes * 1.4) + 80)
});

const businessCouponBaseSchema = z.object({
  code: couponCodeSchema,
  description: optionalTrimmedString(160),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.coerce.number().positive().max(999999),
  maxDiscountAmount: optionalNumberSchema,
  minimumOrderAmount: z.coerce.number().min(0).max(999999).default(0),
  redemptionLimit: optionalIntegerSchema,
  startsAt: optionalIsoDateSchema,
  expiresAt: optionalIsoDateSchema,
  isActive: z.boolean().default(true)
});

function validateCouponAmounts(
  data: {
    discountType?: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue?: number;
    maxDiscountAmount?: number;
    startsAt?: string;
    expiresAt?: string;
  },
  context: z.RefinementCtx
) {
  if (data.discountType === "PERCENTAGE" && data.discountValue !== undefined && data.discountValue > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discounts cannot be more than 100.",
        path: ["discountValue"]
      });
  }

  if (data.maxDiscountAmount !== undefined && data.maxDiscountAmount <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Maximum discount must be greater than 0.",
      path: ["maxDiscountAmount"]
    });
  }

  if (data.startsAt && data.expiresAt && new Date(data.startsAt).getTime() > new Date(data.expiresAt).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start date must be before the expiry date.",
      path: ["startsAt"]
    });
  }
}

export const businessCouponSchema = businessCouponBaseSchema.superRefine(validateCouponAmounts);

export const businessCouponPatchSchema = businessCouponBaseSchema.partial().superRefine(validateCouponAmounts);

export const adminBusinessCouponSchema = businessCouponBaseSchema.extend({
  businessId: z.string().min(1)
}).superRefine(validateCouponAmounts);

export const adminBusinessCouponPatchSchema = businessCouponBaseSchema.extend({
  businessId: z.string().min(1)
}).partial().superRefine(validateCouponAmounts);

const platformSubscriptionCouponBaseSchema = z.object({
  code: couponCodeSchema,
  description: optionalTrimmedString(160),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.coerce.number().positive().max(999999),
  maxDiscountAmount: optionalNumberSchema,
  minimumAmount: z.coerce.number().min(0).max(999999).default(0),
  plan: z.enum(["STARTER", "PRO"]).nullable().optional(),
  redemptionLimit: optionalIntegerSchema,
  startsAt: optionalIsoDateSchema,
  expiresAt: optionalIsoDateSchema,
  isActive: z.boolean().default(true)
});

export const platformSubscriptionCouponSchema = platformSubscriptionCouponBaseSchema.superRefine(validateCouponAmounts);

export const platformSubscriptionCouponPatchSchema = platformSubscriptionCouponBaseSchema.partial().superRefine(validateCouponAmounts);
