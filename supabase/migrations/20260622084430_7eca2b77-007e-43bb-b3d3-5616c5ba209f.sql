
ALTER TABLE public.api_keys 
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_secret text,
  ADD COLUMN IF NOT EXISTS webhook_events text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  target_url text NOT NULL,
  response_status int,
  response_body text,
  success boolean NOT NULL DEFAULT false,
  attempts int NOT NULL DEFAULT 1,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_api_key ON public.webhook_deliveries(api_key_id, created_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_cargo_status_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payload jsonb;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    payload := jsonb_build_object(
      'event', 'shipment.status_changed',
      'cargo_id', NEW.id,
      'track_number', NEW.track_number,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'status_date', NEW.status_date,
      'merchant_id', NEW.merchant_id,
      'customer_code', NEW.customer_code
    );
    PERFORM extensions.http_post(
      url := 'https://xgyalkuyuontavstyokg.supabase.co/functions/v1/webhook-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneWFsa3V5dW9udGF2c3R5b2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODExMTksImV4cCI6MjA4NTI1NzExOX0.aVtiLXFDUqYbXgkbXAsulPThnbdC5CZQVTWye8z8u38'
      ),
      body := payload
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_cargo_status_webhook ON public.cargo;
CREATE TRIGGER trg_dispatch_cargo_status_webhook
  AFTER UPDATE OF status ON public.cargo
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_cargo_status_webhook();
