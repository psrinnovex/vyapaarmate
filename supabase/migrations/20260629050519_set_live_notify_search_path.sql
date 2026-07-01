-- Pin function name resolution for the realtime notification trigger.
ALTER FUNCTION public.bhojzo_live_notify() SET search_path = public, pg_temp;
