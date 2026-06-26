CREATE OR REPLACE FUNCTION public.dispatch_cargo_status_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
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

    BEGIN
      PERFORM net.http_post(
        url := 'https://xgyalkuyuontavstyokg.supabase.co/functions/v1/webhook-dispatcher',
        body := payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneWFsa3V5dW9udGF2c3R5b2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODExMTksImV4cCI6MjA4NTI1NzExOX0.aVtiLXFDUqYbXgkbXAsulPThnbdC5CZQVTWye8z8u38'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'webhook dispatch failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;