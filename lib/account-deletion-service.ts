import { Prisma, type Role } from "@prisma/client";
import {
  accountDeletionRetentionSchedule,
  nextAccountDeletionRetentionReview
} from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";

const removedSupportText = "[Personal content removed after account deletion]";
const removedAuditMetadata = {
  redactedForAccountDeletion: true,
  retentionBasis: "security_fraud_prevention_and_legal_audit"
} satisfies Prisma.InputJsonObject;

type TransactionClient = Prisma.TransactionClient;
type PersonalDeletionRole = Extract<Role, "CUSTOMER" | "MANAGER" | "KITCHEN_STAFF" | "DELIVERY_STAFF">;

function inactiveRetainedAppointmentProviderData(name: string, title: string) {
  // AppointmentProvider_location_check requires one service location. These
  // flags therefore remain unchanged; isActive prevents further bookings.
  return {
    userId: null,
    name,
    title,
    bio: null,
    isActive: false
  } as const;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

async function redactSupportForIdentity(
  tx: TransactionClient,
  user: { id: string; email: string }
) {
  const tickets = await tx.supportTicket.findMany({
    where: {
      OR: [
        { requesterUserId: user.id },
        { requesterEmail: { equals: user.email, mode: Prisma.QueryMode.insensitive } }
      ]
    },
    select: { id: true }
  });
  const ticketIds = tickets.map((ticket) => ticket.id);
  if (!ticketIds.length) return { tickets: 0, messages: 0 };

  const messages = await tx.supportTicketMessage.updateMany({
    where: { ticketId: { in: ticketIds } },
    data: { body: removedSupportText, metadata: Prisma.DbNull }
  });
  const redactedTickets = await tx.supportTicket.updateMany({
    where: { id: { in: ticketIds } },
    data: {
      sessionId: null,
      path: null,
      requesterName: null,
      requesterEmail: null,
      requesterPhone: null,
      requesterBusinessName: null,
      description: removedSupportText,
      lastMessage: removedSupportText,
      safeHandlingNote: "Personal content removed; retain only status and referenced transaction identifiers.",
      metadata: Prisma.DbNull
    }
  });
  return { tickets: redactedTickets.count, messages: messages.count };
}

async function redactAuditForIdentity(tx: TransactionClient, userId: string) {
  return tx.auditLog.updateMany({
    where: { userId },
    data: { metadata: removedAuditMetadata }
  });
}

async function anonymizeCustomerIdentity(
  tx: TransactionClient,
  user: {
    id: string;
    email: string;
    phone: string | null;
    phoneVerifiedAt: Date | null;
  }
) {
  const customers = await tx.customer.findMany({
    where: {
      OR: [
        { email: { equals: user.email, mode: Prisma.QueryMode.insensitive } },
        ...(user.phone && user.phoneVerifiedAt ? [{ phone: user.phone }] : [])
      ]
    },
    select: {
      id: true,
      _count: { select: { orders: true, appointments: true } }
    }
  });
  const customerIds = customers.map((customer) => customer.id);
  const retainedCustomerIds = customers
    .filter((customer) => customer._count.orders > 0 || customer._count.appointments > 0)
    .map((customer) => customer.id);
  const removableCustomerIds = customers
    .filter((customer) => customer._count.orders === 0 && customer._count.appointments === 0)
    .map((customer) => customer.id);

  if (!customerIds.length) {
    return {
      customerProfilesDeleted: 0,
      customerProfilesAnonymized: 0,
      ordersAnonymized: 0,
      appointmentsAnonymized: 0,
      whatsappMessagesDeleted: 0,
      intelligenceRecordsDeleted: 0,
      paymentPriorityRecordsDeleted: 0,
      retainedPayments: 0
    };
  }

  const [orders, appointments, whatsappMessages, intelligence, paymentPriorities, retainedPayments] =
    await Promise.all([
      tx.order.updateMany({
        where: { customerId: { in: customerIds } },
        data: {
          deliveryAddress: null,
          customerLatitude: null,
          customerLongitude: null,
          notes: null,
          cancellationReason: null
        }
      }),
      tx.appointment.updateMany({
        where: { customerId: { in: customerIds } },
        data: { cancellationReason: null, smartReason: null }
      }),
      tx.whatsappMessage.deleteMany({ where: { customerId: { in: customerIds } } }),
      tx.customerIntelligenceScore.deleteMany({ where: { customerId: { in: customerIds } } }),
      tx.paymentPriority.deleteMany({ where: { customerId: { in: customerIds } } }),
      tx.payment.count({ where: { order: { customerId: { in: customerIds } } } })
    ]);

  for (const customerId of retainedCustomerIds) {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name: "Deleted customer",
        phone: `deleted-${customerId}`,
        email: null,
        address: null,
        whatsappOptIn: false,
        marketingOptIn: false,
        trainingEligible: false
      }
    });
  }
  const deletedCustomers = removableCustomerIds.length
    ? await tx.customer.deleteMany({ where: { id: { in: removableCustomerIds } } })
    : { count: 0 };

  return {
    customerProfilesDeleted: deletedCustomers.count,
    customerProfilesAnonymized: retainedCustomerIds.length,
    ordersAnonymized: orders.count,
    appointmentsAnonymized: appointments.count,
    whatsappMessagesDeleted: whatsappMessages.count,
    intelligenceRecordsDeleted: intelligence.count,
    paymentPriorityRecordsDeleted: paymentPriorities.count,
    retainedPayments
  };
}

async function anonymizeStaffIdentity(tx: TransactionClient, userId: string) {
  const providers = await tx.appointmentProvider.findMany({
    where: { userId },
    select: { id: true, _count: { select: { appointments: true } } }
  });
  const providerIds = providers.map((provider) => provider.id);
  const retainedProviderIds = providers
    .filter((provider) => provider._count.appointments > 0)
    .map((provider) => provider.id);
  const removableProviderIds = providers
    .filter((provider) => provider._count.appointments === 0)
    .map((provider) => provider.id);

  if (providerIds.length) {
    await Promise.all([
      tx.appointmentProviderService.deleteMany({ where: { providerId: { in: providerIds } } }),
      tx.appointmentAvailabilityRule.deleteMany({ where: { providerId: { in: providerIds } } }),
      tx.appointmentTimeOff.deleteMany({ where: { providerId: { in: providerIds } } })
    ]);
  }
  const removedProviders = removableProviderIds.length
    ? await tx.appointmentProvider.deleteMany({ where: { id: { in: removableProviderIds } } })
    : { count: 0 };
  const anonymizedProviders = retainedProviderIds.length
    ? await tx.appointmentProvider.updateMany({
        where: { id: { in: retainedProviderIds } },
        data: inactiveRetainedAppointmentProviderData("Deleted staff member", "Former staff")
      })
    : { count: 0 };

  return {
    appointmentProviderProfilesDeleted: removedProviders.count,
    appointmentProviderProfilesAnonymized: anonymizedProviders.count
  };
}

export async function deletePersonalAccountWithClient(
  tx: TransactionClient,
  input: {
    userId: string;
    allowedRoles: readonly PersonalDeletionRole[];
    requestId?: string;
    auditContext?: Prisma.InputJsonObject;
  }
) {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      role: true,
      businessId: true,
      _count: { select: { mobileSessions: true } }
    }
  });
  if (!user || !input.allowedRoles.includes(user.role as PersonalDeletionRole)) {
    throw new Error("ACCOUNT_NOT_ELIGIBLE_FOR_PERSONAL_DELETION");
  }

  const support = await redactSupportForIdentity(tx, user);
  const audit = await redactAuditForIdentity(tx, user.id);
  const customer =
    user.role === "CUSTOMER"
      ? await anonymizeCustomerIdentity(tx, user)
      : {
          customerProfilesDeleted: 0,
          customerProfilesAnonymized: 0,
          ordersAnonymized: 0,
          appointmentsAnonymized: 0,
          whatsappMessagesDeleted: 0,
          intelligenceRecordsDeleted: 0,
          paymentPriorityRecordsDeleted: 0,
          retainedPayments: 0
        };
  const staff =
    user.role === "CUSTOMER"
      ? { appointmentProviderProfilesDeleted: 0, appointmentProviderProfilesAnonymized: 0 }
      : await anonymizeStaffIdentity(tx, user.id);

  const removed = await tx.user.deleteMany({ where: { id: user.id, role: user.role } });
  if (removed.count !== 1) throw new Error("ACCOUNT_CHANGED_DURING_DELETION");

  const result = {
    loginIdentitiesDeleted: 1,
    mobileSessionsRevokedAndDeleted: user._count.mobileSessions,
    browserSessionIdentitiesInvalidated: 1,
    supportTicketsAnonymized: support.tickets,
    supportMessagesAnonymized: support.messages,
    auditRecordsAnonymized: audit.count,
    ...customer,
    ...staff,
    retainedRecords: {
      orders: {
        count: customer.ordersAnonymized,
        basis: "tax_accounting_fulfilment_dispute_and_fraud_prevention"
      },
      appointments: {
        count: customer.appointmentsAnonymized,
        basis: "service_fulfilment_dispute_and_fraud_prevention"
      },
      payments: {
        count: customer.retainedPayments,
        basis: "payment_accounting_tax_refund_and_dispute_obligations"
      },
      auditEvents: {
        count: audit.count + 1,
        basis: "security_fraud_prevention_and_legal_audit"
      }
    }
  } satisfies Prisma.InputJsonObject;

  await tx.auditLog.create({
    data: {
      businessId: user.businessId,
      action: user.role === "CUSTOMER" ? "CUSTOMER_ACCOUNT_DELETED" : "STAFF_ACCOUNT_DELETED",
      entity: "AccountDeletionRequest",
      entityId: input.requestId,
      metadata: { role: user.role, ...result, ...(input.auditContext ?? {}) }
    }
  });
  return { role: user.role as PersonalDeletionRole, businessId: user.businessId, result };
}

export async function deletePersonalAccount(input: {
  userId: string;
  allowedRoles: readonly PersonalDeletionRole[];
  requestId?: string;
  auditContext?: Prisma.InputJsonObject;
}) {
  return prisma.$transaction(
    (tx) => deletePersonalAccountWithClient(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function freezeBusinessForDeletionWithClient(
  tx: TransactionClient,
  input: { businessId: string; now: Date; reason: string }
) {
  const mobileSessions = await tx.mobileSession.findMany({
    where: { user: { businessId: input.businessId }, revokedAt: null },
    select: { id: true }
  });
  const mobileSessionIds = mobileSessions.map((session) => session.id);

  const [, , browserSessionIdentities] = await Promise.all([
    tx.business.update({
      where: { id: input.businessId },
      data: {
        isActive: false,
        isOpen: false,
        allowsPayLater: false,
        subscriptionStatus: "CANCELLED",
        whatsappConnected: false,
        whatsappLiveEnabled: false,
        whatsappAccessTokenEnc: null,
        razorpayRouteEnabled: false,
        cashfreeSplitEnabled: false
      }
    }),
    tx.subscription.updateMany({
      where: { businessId: input.businessId, status: { in: ["ACTIVE", "TRIAL"] } },
      data: { status: "CANCELLED" }
    }),
    tx.user.updateMany({
      where: { businessId: input.businessId },
      data: { sessionVersion: { increment: 1 } }
    })
  ]);

  if (mobileSessionIds.length) {
    await tx.mobileSession.updateMany({
      where: { id: { in: mobileSessionIds }, revokedAt: null },
      data: { revokedAt: input.now, revocationReason: input.reason }
    });
    await tx.mobileRefreshToken.updateMany({
      where: { sessionId: { in: mobileSessionIds }, revokedAt: null },
      data: { revokedAt: input.now }
    });
  }
  return {
    mobileSessionsRevoked: mobileSessionIds.length,
    browserSessionIdentitiesInvalidated: browserSessionIdentities.count
  };
}

export async function processBusinessDeletionWithClient(
  tx: TransactionClient,
  input: { requestId: string; businessId: string; now: Date }
) {
  const business = await tx.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, kycStatus: true }
  });
  if (!business) throw new Error("BUSINESS_NOT_FOUND");

  const [users, customers, providers, tickets, retainedCounts] = await Promise.all([
    tx.user.findMany({
      where: { businessId: business.id },
      select: { id: true, _count: { select: { mobileSessions: true } } }
    }),
    tx.customer.findMany({
      where: { businessId: business.id },
      select: { id: true, _count: { select: { orders: true, appointments: true } } }
    }),
    tx.appointmentProvider.findMany({
      where: { businessId: business.id },
      select: { id: true, _count: { select: { appointments: true } } }
    }),
    tx.supportTicket.findMany({ where: { businessId: business.id }, select: { id: true } }),
    Promise.all([
      tx.order.count({ where: { businessId: business.id } }),
      tx.appointment.count({ where: { businessId: business.id } }),
      tx.payment.count({ where: { businessId: business.id } }),
      tx.subscription.count({ where: { businessId: business.id } }),
      tx.businessPayout.count({ where: { businessId: business.id } }),
      tx.businessWalletEntry.count({ where: { businessId: business.id } }),
      tx.businessKycDocument.count({ where: { businessId: business.id } }),
      tx.auditLog.count({ where: { businessId: business.id } })
    ])
  ]);
  const userIds = users.map((user) => user.id);
  const retainedCustomerIds = customers
    .filter((customer) => customer._count.orders > 0 || customer._count.appointments > 0)
    .map((customer) => customer.id);
  const removableCustomerIds = customers
    .filter((customer) => customer._count.orders === 0 && customer._count.appointments === 0)
    .map((customer) => customer.id);
  const providerIds = providers.map((provider) => provider.id);
  const retainedProviderIds = providers
    .filter((provider) => provider._count.appointments > 0)
    .map((provider) => provider.id);
  const removableProviderIds = providers
    .filter((provider) => provider._count.appointments === 0)
    .map((provider) => provider.id);
  const ticketIds = tickets.map((ticket) => ticket.id);
  const [retainedOrders, retainedAppointments, retainedPayments, retainedSubscriptions, retainedPayouts, retainedWalletEntries, kycDocumentsBeforeDeletion, existingAuditRecords] = retainedCounts;

  const [orders, appointments, whatsappMessages, supportMessages, supportTickets, auditRecords] =
    await Promise.all([
      tx.order.updateMany({
        where: { businessId: business.id },
        data: {
          deliveryAddress: null,
          customerLatitude: null,
          customerLongitude: null,
          notes: null,
          cancellationReason: null
        }
      }),
      tx.appointment.updateMany({
        where: { businessId: business.id },
        data: { cancellationReason: null, smartReason: null }
      }),
      tx.whatsappMessage.deleteMany({ where: { businessId: business.id } }),
      ticketIds.length
        ? tx.supportTicketMessage.updateMany({
            where: { ticketId: { in: ticketIds } },
            data: { body: removedSupportText, metadata: Prisma.DbNull }
          })
        : Promise.resolve({ count: 0 }),
      ticketIds.length
        ? tx.supportTicket.updateMany({
            where: { id: { in: ticketIds } },
            data: {
              sessionId: null,
              path: null,
              requesterName: null,
              requesterEmail: null,
              requesterPhone: null,
              requesterBusinessName: null,
              description: removedSupportText,
              lastMessage: removedSupportText,
              safeHandlingNote: "Personal content removed; retain only status and referenced transaction identifiers.",
              metadata: Prisma.DbNull
            }
          })
        : Promise.resolve({ count: 0 }),
      tx.auditLog.updateMany({
        where: { businessId: business.id },
        data: { metadata: removedAuditMetadata }
      })
    ]);

  const deletedNonRequired = await Promise.all([
    tx.aIInsight.deleteMany({ where: { businessId: business.id } }),
    tx.businessHealthSnapshot.deleteMany({ where: { businessId: business.id } }),
    tx.customerIntelligenceScore.deleteMany({ where: { businessId: business.id } }),
    tx.demandForecast.deleteMany({ where: { businessId: business.id } }),
    tx.paymentPriority.deleteMany({ where: { businessId: business.id } }),
    tx.intelligencePrediction.deleteMany({ where: { businessId: business.id } }),
    tx.intelligenceTrainingRun.deleteMany({ where: { businessId: business.id } }),
    tx.intelligenceModelArtifact.deleteMany({ where: { businessId: business.id } }),
    tx.businessImage.deleteMany({ where: { businessId: business.id } }),
    tx.menuItemImage.deleteMany({ where: { menuItem: { businessId: business.id } } }),
    tx.businessCoupon.deleteMany({ where: { businessId: business.id } }),
    tx.appointmentAvailabilityRule.deleteMany({ where: { businessId: business.id } }),
    tx.appointmentTimeOff.deleteMany({ where: { businessId: business.id } })
  ]);

  if (providerIds.length) {
    await tx.appointmentProviderService.deleteMany({ where: { providerId: { in: providerIds } } });
  }
  const deletedProviders = removableProviderIds.length
    ? await tx.appointmentProvider.deleteMany({ where: { id: { in: removableProviderIds } } })
    : { count: 0 };
  const anonymizedProviders = retainedProviderIds.length
    ? await tx.appointmentProvider.updateMany({
        where: { id: { in: retainedProviderIds } },
        data: inactiveRetainedAppointmentProviderData("Deleted provider", "Former provider")
      })
    : { count: 0 };

  for (const customerId of retainedCustomerIds) {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        name: "Deleted customer",
        phone: `deleted-${customerId}`,
        email: null,
        address: null,
        whatsappOptIn: false,
        marketingOptIn: false,
        trainingEligible: false
      }
    });
  }
  const deletedCustomers = removableCustomerIds.length
    ? await tx.customer.deleteMany({ where: { id: { in: removableCustomerIds } } })
    : { count: 0 };

  const deletedCatalogue = await tx.menuCategory.deleteMany({ where: { businessId: business.id } });
  const deletedKycDocuments = await tx.businessKycDocument.deleteMany({ where: { businessId: business.id } });
  await Promise.all([
    tx.businessWalletEntry.updateMany({
      where: { businessId: business.id },
      data: { description: null, metadata: Prisma.DbNull }
    }),
    tx.businessPayout.updateMany({
      where: { businessId: business.id },
      data: { notes: null, providerStatusDescription: null, providerMetadata: Prisma.DbNull }
    }),
    tx.payment.updateMany({
      where: { businessId: business.id },
      data: { razorpayTransferError: null, paymentRequestUrl: null }
    }),
    tx.subscription.updateMany({
      where: { businessId: business.id },
      data: { paymentRequestUrl: null, status: "CANCELLED" }
    })
  ]);

  await tx.business.update({
    where: { id: business.id },
    data: {
      name: `Deleted business ${business.id.slice(-8)}`,
      slug: `deleted-${business.id}`,
      ownerName: "Deleted owner",
      phone: `deleted-${business.id}`,
      email: `deleted-${business.id}@deleted.invalid`,
      address: "Deleted",
      city: "Deleted",
      state: "Deleted",
      logoUrl: null,
      whatsappDisplayPhone: null,
      whatsappPhoneNumberId: null,
      whatsappWabaId: null,
      whatsappAccessTokenEnc: null,
      whatsappConnected: false,
      whatsappLiveEnabled: false,
      whatsappApprovedAt: null,
      kycRejectionReason: null,
      isVerified: false,
      isActive: false,
      isOpen: false,
      latitude: null,
      longitude: null,
      allowsPayLater: false,
      appointmentBookingEnabled: false,
      paymentUpiId: null,
      paymentUpiName: null,
      payoutUpiId: null,
      payoutUpiName: null,
      payoutAccountHolderName: null,
      payoutBankName: null,
      payoutBankAccountNumber: null,
      payoutBankIfsc: null,
      cashfreePayoutBeneficiaryId: null,
      razorpayLinkedAccountId: null,
      razorpayRouteEnabled: false,
      cashfreeVendorId: null,
      cashfreeSplitEnabled: false,
      subscriptionStatus: "CANCELLED"
    }
  });

  const deletedUsers = userIds.length
    ? await tx.user.deleteMany({ where: { id: { in: userIds }, businessId: business.id } })
    : { count: 0 };
  const deletedNonRequiredCount = deletedNonRequired.reduce((total, item) => total + item.count, 0);
  const result = {
    loginIdentitiesDeleted: deletedUsers.count,
    mobileSessionsRevokedAndDeleted: users.reduce((total, user) => total + user._count.mobileSessions, 0),
    browserSessionIdentitiesInvalidated: users.length,
    customerProfilesDeleted: deletedCustomers.count,
    customerProfilesAnonymized: retainedCustomerIds.length,
    appointmentProviderProfilesDeleted: deletedProviders.count,
    appointmentProviderProfilesAnonymized: anonymizedProviders.count,
    ordersAnonymized: orders.count,
    appointmentsAnonymized: appointments.count,
    whatsappMessagesDeleted: whatsappMessages.count,
    supportTicketsAnonymized: supportTickets.count,
    supportMessagesAnonymized: supportMessages.count,
    auditRecordsAnonymized: auditRecords.count,
    catalogueGroupsDeleted: deletedCatalogue.count,
    kycDocumentUploadsDeleted: deletedKycDocuments.count,
    nonRequiredIntelligenceImageAndPolicyRecordsDeleted: deletedNonRequiredCount,
    retainedRecords: {
      orders: { count: retainedOrders, basis: "tax_accounting_fulfilment_dispute_and_fraud_prevention" },
      appointments: { count: retainedAppointments, basis: "service_fulfilment_dispute_and_fraud_prevention" },
      payments: { count: retainedPayments, basis: "payment_accounting_tax_refund_and_dispute_obligations" },
      subscriptionsAndInvoices: { count: retainedSubscriptions, basis: "tax_accounting_and_contract_records" },
      payouts: { count: retainedPayouts, basis: "payment_aml_accounting_tax_and_dispute_obligations" },
      walletEntries: { count: retainedWalletEntries, basis: "accounting_reconciliation_fraud_and_dispute_obligations" },
      kycVerificationOutcome: {
        count: kycDocumentsBeforeDeletion > 0 ? 1 : 0,
        outcome: business.kycStatus,
        basis: "minimal_verification_audit_outcome_subject_to_retention_review"
      },
      auditEvents: { count: existingAuditRecords + 1, basis: "security_fraud_prevention_and_legal_audit" }
    }
  } satisfies Prisma.InputJsonObject;

  await tx.auditLog.create({
    data: {
      businessId: business.id,
      action: "BUSINESS_ACCOUNT_DELETION_COMPLETED",
      entity: "AccountDeletionRequest",
      entityId: input.requestId,
      metadata: result
    }
  });
  await tx.accountDeletionRequest.update({
    where: { id: input.requestId },
    data: {
      status: "COMPLETED",
      processingAt: null,
      completedAt: input.now,
      reason: null,
      ...accountDeletionRetentionSchedule(input.now),
      result,
      verificationTokenHash: null,
      verificationExpiresAt: null
    }
  });
  return result;
}

export async function completeBusinessRetentionReviewWithClient(
  tx: TransactionClient,
  input: {
    requestId: string;
    now: Date;
    actorUserId: string;
    note: string;
  }
) {
  const request = await tx.accountDeletionRequest.findUnique({ where: { id: input.requestId } });
  if (
    !request ||
    request.scope !== "BUSINESS" ||
    request.status !== "COMPLETED" ||
    request.retentionPurgedAt ||
    !request.retentionReviewAt ||
    !request.retentionPurgeAfter
  ) {
    throw new Error("RETENTION_REQUEST_NOT_REVIEWABLE");
  }
  if (request.retentionReviewAt > input.now) throw new Error("RETENTION_REVIEW_NOT_DUE");
  if (request.retentionPurgeAfter <= input.now) throw new Error("RETENTION_PURGE_IS_DUE");

  const nextReviewAt = nextAccountDeletionRetentionReview(input.now, request.retentionPurgeAfter);
  const previousResult = jsonObject(request.result);
  const previousReviews = Array.isArray(previousResult.retentionReviews)
    ? previousResult.retentionReviews
    : [];
  const review = {
    reviewedAt: input.now.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
    policyVersion: request.retentionNoticeVersion,
    note: input.note
  } satisfies Prisma.InputJsonObject;

  const updated = await tx.accountDeletionRequest.update({
    where: { id: request.id },
    data: {
      retentionLastReviewedAt: input.now,
      retentionReviewAt: nextReviewAt,
      retentionReviewCount: { increment: 1 },
      result: {
        ...(previousResult as Prisma.InputJsonObject),
        retentionReviews: [...previousReviews, review]
      }
    }
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorUserId,
      businessId: request.businessId,
      action: "ACCOUNT_RETENTION_REVIEW_COMPLETED",
      entity: "AccountDeletionRequest",
      entityId: request.id,
      metadata: review
    }
  });
  return updated;
}

export async function purgeBusinessRetentionWithClient(
  tx: TransactionClient,
  input: {
    requestId: string;
    now: Date;
    actorUserId?: string;
  }
) {
  const request = await tx.accountDeletionRequest.findUnique({ where: { id: input.requestId } });
  if (
    !request ||
    request.scope !== "BUSINESS" ||
    request.status !== "COMPLETED" ||
    request.retentionPurgedAt ||
    !request.retentionPurgeAfter
  ) {
    throw new Error("RETENTION_REQUEST_NOT_PURGEABLE");
  }
  if (request.retentionPurgeAfter > input.now) throw new Error("RETENTION_PURGE_NOT_DUE");
  if (request.retentionHoldUntil && request.retentionHoldUntil > input.now) {
    throw new Error("RETENTION_LEGAL_HOLD_ACTIVE");
  }

  const deletedBusiness = request.businessId
    ? await tx.business.deleteMany({ where: { id: request.businessId } })
    : { count: 0 };
  const purgeResult = {
    purgedAt: input.now.toISOString(),
    policyVersion: request.retentionNoticeVersion,
    businessRecordDeleted: deletedBusiness.count === 1,
    businessRecordAlreadyAbsent: deletedBusiness.count === 0
  } satisfies Prisma.InputJsonObject;
  const updated = await tx.accountDeletionRequest.update({
    where: { id: request.id },
    data: {
      retentionPurgedAt: input.now,
      retentionReviewAt: null,
      retentionHoldUntil: null,
      retentionHoldReason: null,
      result: {
        ...(jsonObject(request.result) as Prisma.InputJsonObject),
        retentionPurge: purgeResult
      }
    }
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorUserId,
      action: "ACCOUNT_RETENTION_FINAL_PURGE_COMPLETED",
      entity: "AccountDeletionRequest",
      entityId: request.id,
      metadata: purgeResult
    }
  });
  return updated;
}
