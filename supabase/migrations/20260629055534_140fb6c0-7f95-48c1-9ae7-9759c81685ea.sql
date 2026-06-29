
-- Extend cargo table
ALTER TABLE public.cargo
  ADD COLUMN IF NOT EXISTS tracking_carrier integer,
  ADD COLUMN IF NOT EXISTS tracking_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_register_error text,
  ADD COLUMN IF NOT EXISTS tracking_status_17track text,
  ADD COLUMN IF NOT EXISTS tracking_sub_status_17track text,
  ADD COLUMN IF NOT EXISTS tracking_latest_event_description text,
  ADD COLUMN IF NOT EXISTS tracking_latest_event_location text,
  ADD COLUMN IF NOT EXISTS tracking_latest_event_time timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_raw jsonb,
  ADD COLUMN IF NOT EXISTS china_tracking_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_status_source text,
  ADD COLUMN IF NOT EXISTS ereen_received_detected_at timestamptz;

-- Extend preregistrations
ALTER TABLE public.cargo_preregistrations
  ADD COLUMN IF NOT EXISTS tracking_carrier integer,
  ADD COLUMN IF NOT EXISTS tracking_registered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_register_error text,
  ADD COLUMN IF NOT EXISTS tracking_status_17track text,
  ADD COLUMN IF NOT EXISTS tracking_last_sync_at timestamptz;

-- tracking_events table
CREATE TABLE IF NOT EXISTS public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id uuid REFERENCES public.cargo(id) ON DELETE CASCADE,
  preregistration_id uuid REFERENCES public.cargo_preregistrations(id) ON DELETE CASCADE,
  tracking_number text NOT NULL,
  carrier integer,
  event_time timestamptz,
  event_time_raw text,
  description text,
  description_translation text,
  location text,
  stage text,
  sub_status text,
  country text,
  state text,
  city text,
  provider_name text,
  provider_key text,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_cargo ON public.tracking_events(cargo_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_prereg ON public.tracking_events(preregistration_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_track ON public.tracking_events(tracking_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_events_dedupe
  ON public.tracking_events(tracking_number, COALESCE(event_time, 'epoch'::timestamptz), COALESCE(description,''), COALESCE(location,''), COALESCE(provider_key,''));

GRANT SELECT ON public.tracking_events TO authenticated;
GRANT ALL ON public.tracking_events TO service_role;

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cargo tracking events"
  ON public.tracking_events FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.cargo c WHERE c.id = tracking_events.cargo_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.cargo_preregistrations p WHERE p.id = tracking_events.preregistration_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage tracking events"
  ON public.tracking_events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- site settings flag
INSERT INTO public.site_settings(key, value)
VALUES ('auto_mark_ereen_received', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
