-- Authenticated app streams use these compact notifications to refresh
-- server-filtered API payloads without exposing browser-side table access.

CREATE OR REPLACE FUNCTION public.bhojzo_live_notify()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_data jsonb;
  business_id text;
  customer_id text;
  customer_email text;
  customer_phone text;
  order_id text;
  public_token text;
  ticket_id text;
  user_id text;
  is_global boolean := false;
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  business_id := row_data ->> 'businessId';
  customer_id := row_data ->> 'customerId';
  order_id := row_data ->> 'orderId';
  public_token := row_data ->> 'publicToken';
  ticket_id := row_data ->> 'ticketId';
  user_id := COALESCE(row_data ->> 'userId', row_data ->> 'id');

  IF TG_TABLE_NAME = 'Business' THEN
    business_id := row_data ->> 'id';
  ELSIF TG_TABLE_NAME = 'Customer' THEN
    customer_id := row_data ->> 'id';
    customer_email := row_data ->> 'email';
    customer_phone := row_data ->> 'phone';
  ELSIF TG_TABLE_NAME = 'Order' THEN
    order_id := row_data ->> 'id';
    public_token := row_data ->> 'publicToken';
    SELECT c."email", c."phone"
      INTO customer_email, customer_phone
      FROM public."Customer" c
      WHERE c."id" = customer_id;
  ELSIF TG_TABLE_NAME = 'OrderItem' THEN
    SELECT o."businessId", o."customerId", o."id", o."publicToken", c."email", c."phone"
      INTO business_id, customer_id, order_id, public_token, customer_email, customer_phone
      FROM public."Order" o
      LEFT JOIN public."Customer" c ON c."id" = o."customerId"
      WHERE o."id" = order_id;
  ELSIF TG_TABLE_NAME = 'Payment' THEN
    SELECT o."customerId", o."publicToken", c."email", c."phone"
      INTO customer_id, public_token, customer_email, customer_phone
      FROM public."Order" o
      LEFT JOIN public."Customer" c ON c."id" = o."customerId"
      WHERE o."id" = order_id;
  ELSIF TG_TABLE_NAME = 'MenuItemImage' THEN
    SELECT mi."businessId"
      INTO business_id
      FROM public."MenuItem" mi
      WHERE mi."id" = row_data ->> 'menuItemId';
  ELSIF TG_TABLE_NAME = 'SupportTicket' THEN
    ticket_id := row_data ->> 'id';
    user_id := COALESCE(row_data ->> 'requesterUserId', row_data ->> 'assignedToUserId');
  ELSIF TG_TABLE_NAME = 'SupportTicketMessage' THEN
    SELECT st."businessId", st."id", COALESCE(st."requesterUserId", st."assignedToUserId")
      INTO business_id, ticket_id, user_id
      FROM public."SupportTicket" st
      WHERE st."id" = ticket_id;
  ELSIF TG_TABLE_NAME IN ('BusinessServiceType', 'PlatformPaymentSettings', 'PlatformSubscriptionCoupon') THEN
    is_global := true;
  END IF;

  PERFORM pg_notify(
    'bhojzo_live_changes',
    jsonb_strip_nulls(
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'businessId', business_id,
        'customerId', customer_id,
        'customerEmail', customer_email,
        'customerPhone', customer_phone,
        'orderId', order_id,
        'publicToken', public_token,
        'ticketId', ticket_id,
        'userId', user_id,
        'global', is_global,
        'occurredAt', clock_timestamp()
      )
    )::text
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bhojzo_live_notify() FROM PUBLIC;

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.bhojzo_live_notify() FROM %I', app_role);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  live_table text;
BEGIN
  FOREACH live_table IN ARRAY ARRAY[
    'AuditLog',
    'Business',
    'BusinessCoupon',
    'BusinessImage',
    'BusinessKycDocument',
    'BusinessPayout',
    'BusinessServiceType',
    'BusinessWalletEntry',
    'Customer',
    'MenuCategory',
    'MenuItem',
    'MenuItemImage',
    'Order',
    'OrderItem',
    'Payment',
    'PlatformPaymentSettings',
    'PlatformSubscriptionCoupon',
    'Subscription',
    'SupportTicket',
    'SupportTicketMessage',
    'User',
    'WhatsappMessage'
  ]
  LOOP
    IF to_regclass(format('public.%I', live_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS bhojzo_live_notify_trigger ON public.%I', live_table);
      EXECUTE format(
        'CREATE TRIGGER bhojzo_live_notify_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bhojzo_live_notify()',
        live_table
      );
    END IF;
  END LOOP;
END $$;
