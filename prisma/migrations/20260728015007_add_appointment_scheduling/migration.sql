-- Reusable appointment scheduling for salons, studios, home services, tailoring,
-- laundry, catering, and other time-based service businesses.

CREATE TYPE "AppointmentStatus" AS ENUM (
  'REQUESTED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);

CREATE TYPE "AppointmentSource" AS ENUM (
  'CUSTOMER_WEB',
  'DASHBOARD',
  'WHATSAPP',
  'AI_ASSISTED'
);

ALTER TABLE "Business"
  ADD COLUMN "appointmentBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "appointmentAutoConfirm" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "appointmentTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN "appointmentSlotInterval" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "appointmentLeadTimeMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "appointmentMaxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "appointmentCancelNoticeMins" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "Business"
  ADD CONSTRAINT "Business_appointmentSlotInterval_check"
    CHECK ("appointmentSlotInterval" BETWEEN 5 AND 120),
  ADD CONSTRAINT "Business_appointmentLeadTimeMinutes_check"
    CHECK ("appointmentLeadTimeMinutes" BETWEEN 0 AND 10080),
  ADD CONSTRAINT "Business_appointmentMaxAdvanceDays_check"
    CHECK ("appointmentMaxAdvanceDays" BETWEEN 1 AND 365),
  ADD CONSTRAINT "Business_appointmentCancelNoticeMins_check"
    CHECK ("appointmentCancelNoticeMins" BETWEEN 0 AND 43200);

ALTER TABLE "MenuItem"
  ADD COLUMN "appointmentEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_durationMinutes_check"
    CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 5 AND 1440),
  ADD CONSTRAINT "MenuItem_bufferMinutes_check"
    CHECK ("bufferMinutes" BETWEEN 0 AND 240),
  ADD CONSTRAINT "MenuItem_appointmentDuration_check"
    CHECK (NOT "appointmentEnabled" OR "durationMinutes" IS NOT NULL);

CREATE TABLE "AppointmentProvider" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bio" TEXT,
  "color" TEXT NOT NULL DEFAULT '#0F766E',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "acceptsAtBusiness" BOOLEAN NOT NULL DEFAULT true,
  "acceptsAtCustomerLocation" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppointmentProvider_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppointmentProvider_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT "AppointmentProvider_location_check" CHECK ("acceptsAtBusiness" OR "acceptsAtCustomerLocation")
);

CREATE TABLE "AppointmentProviderService" (
  "providerId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "durationOverrideMinutes" INTEGER,
  "bufferOverrideMinutes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppointmentProviderService_pkey" PRIMARY KEY ("providerId", "menuItemId"),
  CONSTRAINT "AppointmentProviderService_duration_check"
    CHECK ("durationOverrideMinutes" IS NULL OR "durationOverrideMinutes" BETWEEN 5 AND 1440),
  CONSTRAINT "AppointmentProviderService_buffer_check"
    CHECK ("bufferOverrideMinutes" IS NULL OR "bufferOverrideMinutes" BETWEEN 0 AND 240)
);

CREATE TABLE "AppointmentAvailabilityRule" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppointmentAvailabilityRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppointmentAvailabilityRule_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "AppointmentAvailabilityRule_minutes_check"
    CHECK ("startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 1 AND 1440 AND "endMinute" > "startMinute")
);

CREATE TABLE "AppointmentTimeOff" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "providerId" TEXT,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppointmentTimeOff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AppointmentTimeOff_range_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,
  "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "blockedUntil" TIMESTAMPTZ(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "source" "AppointmentSource" NOT NULL DEFAULT 'CUSTOMER_WEB',
  "autoConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "smartScore" INTEGER,
  "smartReason" TEXT,
  "confirmedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "reminderSentAt" TIMESTAMPTZ(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Appointment_time_range_check"
    CHECK ("endsAt" > "startsAt" AND "blockedUntil" >= "endsAt"),
  CONSTRAINT "Appointment_smartScore_check"
    CHECK ("smartScore" IS NULL OR "smartScore" BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX "AppointmentProvider_businessId_userId_key"
  ON "AppointmentProvider"("businessId", "userId");
CREATE INDEX "AppointmentProvider_businessId_isActive_sortOrder_idx"
  ON "AppointmentProvider"("businessId", "isActive", "sortOrder");
CREATE INDEX "AppointmentProviderService_menuItemId_providerId_idx"
  ON "AppointmentProviderService"("menuItemId", "providerId");
CREATE UNIQUE INDEX "AppointmentAvailabilityRule_providerId_weekday_startMinute_endMinute_key"
  ON "AppointmentAvailabilityRule"("providerId", "weekday", "startMinute", "endMinute");
CREATE INDEX "AppointmentAvailabilityRule_businessId_weekday_isActive_idx"
  ON "AppointmentAvailabilityRule"("businessId", "weekday", "isActive");
CREATE INDEX "AppointmentAvailabilityRule_providerId_weekday_isActive_idx"
  ON "AppointmentAvailabilityRule"("providerId", "weekday", "isActive");
CREATE INDEX "AppointmentTimeOff_businessId_startsAt_endsAt_idx"
  ON "AppointmentTimeOff"("businessId", "startsAt", "endsAt");
CREATE INDEX "AppointmentTimeOff_providerId_startsAt_endsAt_idx"
  ON "AppointmentTimeOff"("providerId", "startsAt", "endsAt");
CREATE UNIQUE INDEX "Appointment_orderId_key" ON "Appointment"("orderId");
CREATE INDEX "Appointment_businessId_startsAt_status_idx"
  ON "Appointment"("businessId", "startsAt", "status");
CREATE INDEX "Appointment_providerId_startsAt_status_idx"
  ON "Appointment"("providerId", "startsAt", "status");
CREATE INDEX "Appointment_customerId_startsAt_idx"
  ON "Appointment"("customerId", "startsAt");
CREATE INDEX "Appointment_status_reminderSentAt_startsAt_idx"
  ON "Appointment"("status", "reminderSentAt", "startsAt");
CREATE INDEX "Appointment_active_business_start_idx"
  ON "Appointment"("businessId", "startsAt")
  WHERE "status" IN ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS');

ALTER TABLE "AppointmentProvider"
  ADD CONSTRAINT "AppointmentProvider_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentProvider_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AppointmentProviderService"
  ADD CONSTRAINT "AppointmentProviderService_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "AppointmentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentProviderService_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentAvailabilityRule"
  ADD CONSTRAINT "AppointmentAvailabilityRule_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentAvailabilityRule_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "AppointmentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentTimeOff"
  ADD CONSTRAINT "AppointmentTimeOff_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AppointmentTimeOff_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "AppointmentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Appointment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Appointment_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Appointment_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "AppointmentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep every scheduling relation inside one business tenant even when writes
-- are performed outside the application API.
CREATE OR REPLACE FUNCTION public.appointment_enforce_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'AppointmentProviderService' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "AppointmentProvider" AS provider
      JOIN "MenuItem" AS item ON item."id" = NEW."menuItemId"
      WHERE provider."id" = NEW."providerId"
        AND provider."businessId" = item."businessId"
    ) THEN
      RAISE EXCEPTION 'Appointment provider and service must belong to the same business' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'AppointmentAvailabilityRule' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AppointmentProvider" AS provider
      WHERE provider."id" = NEW."providerId" AND provider."businessId" = NEW."businessId"
    ) THEN
      RAISE EXCEPTION 'Availability provider must belong to the same business' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'AppointmentTimeOff' AND NEW."providerId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AppointmentProvider" AS provider
      WHERE provider."id" = NEW."providerId" AND provider."businessId" = NEW."businessId"
    ) THEN
      RAISE EXCEPTION 'Time off provider must belong to the same business' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'Appointment' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "AppointmentProvider" AS provider
      JOIN "Order" AS booking_order ON booking_order."id" = NEW."orderId"
      JOIN "Customer" AS customer ON customer."id" = NEW."customerId"
      WHERE provider."id" = NEW."providerId"
        AND provider."businessId" = NEW."businessId"
        AND booking_order."businessId" = NEW."businessId"
        AND booking_order."customerId" = NEW."customerId"
        AND customer."businessId" = NEW."businessId"
    ) THEN
      RAISE EXCEPTION 'Appointment relations must belong to the same business and customer' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_provider_service_tenant_guard
  BEFORE INSERT OR UPDATE ON "AppointmentProviderService"
  FOR EACH ROW EXECUTE FUNCTION public.appointment_enforce_tenant_integrity();
CREATE TRIGGER appointment_availability_tenant_guard
  BEFORE INSERT OR UPDATE ON "AppointmentAvailabilityRule"
  FOR EACH ROW EXECUTE FUNCTION public.appointment_enforce_tenant_integrity();
CREATE TRIGGER appointment_time_off_tenant_guard
  BEFORE INSERT OR UPDATE ON "AppointmentTimeOff"
  FOR EACH ROW EXECUTE FUNCTION public.appointment_enforce_tenant_integrity();
CREATE TRIGGER appointment_tenant_guard
  BEFORE INSERT OR UPDATE ON "Appointment"
  FOR EACH ROW EXECUTE FUNCTION public.appointment_enforce_tenant_integrity();

REVOKE ALL ON FUNCTION public.appointment_enforce_tenant_integrity() FROM PUBLIC;

-- Database-level concurrency protection. The partial exclusion constraint keeps
-- cancelled/no-show/completed history while preventing overlapping live holds.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_provider_time_no_overlap"
  EXCLUDE USING gist (
    "providerId" WITH =,
    tstzrange("startsAt", "blockedUntil", '[)') WITH &&
  )
  WHERE ("status" IN ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS'));

-- Turn on scheduling only for current categories that inherently require a
-- date/time. Retail and ordinary food ordering stay unchanged.
UPDATE "Business"
SET "appointmentBookingEnabled" = true
WHERE lower("businessType") ~ '(salon|saloon|spa|grooming|beauty|fitness|yoga|class|studio|home service|cleaning|repair|appliance|plumber|electrician|tailor|boutique|alteration|laundry|dry clean|ironing|catering)';

UPDATE "MenuItem" AS item
SET
  "appointmentEnabled" = true,
  "durationMinutes" = COALESCE(item."durationMinutes", 30)
FROM "Business" AS business
WHERE business."id" = item."businessId"
  AND business."appointmentBookingEnabled" = true;

INSERT INTO "AppointmentProvider" (
  "id",
  "businessId",
  "userId",
  "name",
  "title",
  "acceptsAtBusiness",
  "acceptsAtCustomerLocation",
  "createdAt",
  "updatedAt"
)
SELECT
  'apv_' || md5(business."id"),
  business."id",
  (
    SELECT owner."id"
    FROM "User" AS owner
    WHERE owner."businessId" = business."id" AND owner."role" = 'OWNER'
    ORDER BY owner."createdAt" ASC
    LIMIT 1
  ),
  business."ownerName",
  CASE
    WHEN lower(business."businessType") ~ '(salon|saloon|spa|grooming|beauty)' THEN 'Stylist'
    WHEN lower(business."businessType") ~ '(fitness|yoga|class|studio)' THEN 'Instructor'
    WHEN lower(business."businessType") ~ '(tailor|boutique|alteration)' THEN 'Tailor'
    WHEN lower(business."businessType") ~ '(laundry|dry clean|ironing)' THEN 'Service professional'
    WHEN lower(business."businessType") ~ 'catering' THEN 'Booking coordinator'
    ELSE 'Service professional'
  END,
  business."acceptsDineIn" OR business."acceptsPickup" OR NOT business."acceptsServiceAtLocation",
  business."acceptsServiceAtLocation",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Business" AS business
WHERE business."appointmentBookingEnabled" = true
ON CONFLICT DO NOTHING;

INSERT INTO "AppointmentProviderService" ("providerId", "menuItemId")
SELECT provider."id", item."id"
FROM "AppointmentProvider" AS provider
JOIN "MenuItem" AS item ON item."businessId" = provider."businessId"
WHERE item."appointmentEnabled" = true
ON CONFLICT DO NOTHING;

ALTER TABLE "AppointmentProvider" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentProviderService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentAvailabilityRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentTimeOff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "AppointmentProvider",
  "AppointmentProviderService",
  "AppointmentAvailabilityRule",
  "AppointmentTimeOff",
  "Appointment"
FROM PUBLIC;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.appointment_enforce_tenant_integrity() FROM %I', app_role);
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE "AppointmentProvider", "AppointmentProviderService", "AppointmentAvailabilityRule", "AppointmentTimeOff", "Appointment" FROM %I',
        app_role
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  live_table text;
BEGIN
  IF to_regprocedure('public.bhojzo_live_notify()') IS NOT NULL THEN
    FOREACH live_table IN ARRAY ARRAY[
      'AppointmentProvider',
      'AppointmentProviderService',
      'AppointmentAvailabilityRule',
      'AppointmentTimeOff',
      'Appointment'
    ]
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS bhojzo_live_notify_trigger ON public.%I', live_table);
      EXECUTE format(
        'CREATE TRIGGER bhojzo_live_notify_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bhojzo_live_notify()',
        live_table
      );
    END LOOP;
  END IF;
END $$;
