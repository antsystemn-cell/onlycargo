
-- Enable pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- webhook_deliveries: retry & idempotency
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Backfill status from success flag for existing rows
UPDATE public.webhook_deliveries
SET status = CASE WHEN success THEN 'success' ELSE 'failed' END
WHERE status = 'pending' AND last_attempt_at IS NULL;

-- Unique index for idempotency (event_id + api_key_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_deliveries_event_key
  ON public.webhook_deliveries (event_id, api_key_id)
  WHERE event_id IS NOT NULL;

-- Index for retry worker
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry
  ON public.webhook_deliveries (status, next_retry_at)
  WHERE status = 'pending';

-- Update trigger: include event_id, location, updated_at
CREATE OR REPLACE FUNCTION public.dispatch_cargo_status_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  payload jsonb;
  loc_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    loc_label := CASE NEW.status
      WHEN 'registered' THEN 'Эрээн агуулах (бүртгэл)'
      WHEN 'received_ereen' THEN 'Эрээн агуулах'
      WHEN 'transporting' THEN 'Замд'
      WHEN 'warehouse_processing' THEN 'УБ агуулах (боловсруулж байна)'
      WHEN 'ready_warehouse' THEN 'УБ агуулах (бэлэн)'
      WHEN 'completed' THEN 'Хүлээлгэж өгсөн'
      ELSE NULL
    END;

    payload := jsonb_build_object(
      'event', 'shipment.status_changed',
      'event_id', gen_random_uuid()::text,
      'cargo_id', NEW.id,
      'track_number', NEW.track_number,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'status_date', NEW.status_date,
      'updated_at', NEW.updated_at,
      'location', loc_label,
      'merchant_id', NEW.merchant_id,
      'customer_code', NEW.customer_code,
      'branch_id', NEW.branch_id
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
$function$;

-- Cron: invoke webhook-retry every minute
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhook-retry-every-minute') THEN
    PERFORM cron.schedule(
      'webhook-retry-every-minute',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://xgyalkuyuontavstyokg.supabase.co/functions/v1/webhook-retry',
        headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneWFsa3V5dW9udGF2c3R5b2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODExMTksImV4cCI6MjA4NTI1NzExOX0.aVtiLXFDUqYbXgkbXAsulPThnbdC5CZQVTWye8z8u38"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
