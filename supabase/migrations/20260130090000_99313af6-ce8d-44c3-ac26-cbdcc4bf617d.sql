-- ==============================================
-- PART 1: Status enum update and basic tables
-- ==============================================

-- 1. DROP OLD STATUS ENUM AND CREATE NEW ONE
DROP VIEW IF EXISTS public.cargo_public;

-- Create new status enum
CREATE TYPE public.cargo_status_new AS ENUM (
  'registered',
  'received_ereen',
  'transporting',
  'warehouse_processing',
  'ready_warehouse',
  'completed'
);

-- Add a temporary column with the new type
ALTER TABLE public.cargo ADD COLUMN status_new cargo_status_new;

-- Migrate old statuses to new ones
UPDATE public.cargo SET status_new = 
  CASE status::text
    WHEN 'registered' THEN 'registered'::cargo_status_new
    WHEN 'in_transit' THEN 'transporting'::cargo_status_new
    WHEN 'arrived_ub' THEN 'ready_warehouse'::cargo_status_new
    WHEN 'completed' THEN 'completed'::cargo_status_new
    ELSE 'registered'::cargo_status_new
  END;

-- Drop the old column and rename
ALTER TABLE public.cargo DROP COLUMN status;
ALTER TABLE public.cargo RENAME COLUMN status_new TO status;
ALTER TABLE public.cargo ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.cargo ALTER COLUMN status SET DEFAULT 'registered'::cargo_status_new;

-- Drop old enum and rename new one
DROP TYPE public.cargo_status;
ALTER TYPE public.cargo_status_new RENAME TO cargo_status;

-- Recreate the cargo_public view
CREATE VIEW public.cargo_public 
WITH (security_invoker=on) AS
  SELECT id, track_number, status, status_date, created_at
  FROM public.cargo;

-- 2. CREATE BRANCHES TABLE
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active branches"
  ON public.branches FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage branches"
  ON public.branches FOR ALL
  USING (is_admin());

INSERT INTO public.branches (name, code, address, phone) VALUES
  ('Улаанбаатар төв', 'UB_MAIN', 'Улаанбаатар хот, СБД', '77001234'),
  ('Дархан', 'DARKHAN', 'Дархан-Уул аймаг', '70371234'),
  ('Эрдэнэт', 'ERDENET', 'Орхон аймаг', '70351234'),
  ('Эрээн агуулах', 'EREEN', 'Хятад, Эрээн хот', '13694788211');

-- 3. ADD BRANCH_ID TO CARGO AND PROFILES
ALTER TABLE public.cargo ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.profiles ADD COLUMN default_branch_id uuid REFERENCES public.branches(id);

-- 4. CREATE STATUS HISTORY TABLE
CREATE TABLE public.cargo_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id uuid NOT NULL REFERENCES public.cargo(id) ON DELETE CASCADE,
  status cargo_status NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cargo_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cargo status history"
  ON public.cargo_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo c 
      WHERE c.id = cargo_id 
      AND (c.user_id = auth.uid() OR c.phone_number = get_user_phone() OR is_admin())
    )
  );

CREATE POLICY "Admins can insert status history"
  ON public.cargo_status_history FOR INSERT
  WITH CHECK (is_admin());

-- 5. CREATE SITE SETTINGS TABLE
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR ALL
  USING (is_admin());

INSERT INTO public.site_settings (key, value) VALUES
  ('logo_url', '"/placeholder.svg"'::jsonb),
  ('china_warehouse_address', '{"receiver": "唯一OnlyCargo", "phone": "13694788211", "region": "内蒙古，锡林郭勒盟，二连浩特市, 肯特街", "address": "白音布日特物流巴图收"}'::jsonb),
  ('homepage_banner', '{"enabled": true, "title": "Онлайн карго үйлчилгээ", "description": "Хятадаас Монгол руу хурдан, найдвартай тээвэр"}'::jsonb),
  ('homepage_widgets', '[{"id": "calculator", "title": "Тооцоолуур", "icon": "calculator", "enabled": true}, {"id": "tracking", "title": "Ачаа хайх", "icon": "search", "enabled": true}, {"id": "address", "title": "Хятад хаяг", "icon": "map-pin", "enabled": true}]'::jsonb),
  ('pricing', '{"per_kg": 8000, "per_cubic_meter": 312000, "china_per_kg": 2500}'::jsonb);

-- 6. CREATE CARGO PHOTOS TABLE
CREATE TABLE public.cargo_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id uuid NOT NULL REFERENCES public.cargo(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cargo_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cargo photos"
  ON public.cargo_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cargo c 
      WHERE c.id = cargo_id 
      AND (c.user_id = auth.uid() OR c.phone_number = get_user_phone() OR is_admin())
    )
  );

CREATE POLICY "Admins can upload photos"
  ON public.cargo_photos FOR INSERT
  WITH CHECK (is_admin());

-- 7. CREATE USER PRE-REGISTRATION TABLE
CREATE TABLE public.cargo_preregistrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track_number text NOT NULL,
  description text,
  matched_cargo_id uuid REFERENCES public.cargo(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cargo_preregistrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pre-registrations"
  ON public.cargo_preregistrations FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert pre-registrations"
  ON public.cargo_preregistrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pre-registrations"
  ON public.cargo_preregistrations FOR DELETE
  USING (user_id = auth.uid());

-- 8. UPDATE CARGO TABLE FOR CHINA WAREHOUSE CALCULATIONS
ALTER TABLE public.cargo ADD COLUMN cubic_meter_price numeric;
ALTER TABLE public.cargo ADD COLUMN kg_price numeric;
ALTER TABLE public.cargo ADD COLUMN total_cubic_meters numeric;
ALTER TABLE public.cargo ADD COLUMN registered_by uuid;

-- 9. ADD TRIGGER FOR STATUS HISTORY
CREATE OR REPLACE FUNCTION public.log_cargo_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.cargo_status_history (cargo_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
    
    NEW.status_date = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cargo_status_change_trigger
  BEFORE UPDATE ON public.cargo
  FOR EACH ROW
  EXECUTE FUNCTION public.log_cargo_status_change();

-- 10. CREATE STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cargo-photos', 'cargo-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view cargo photos"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('cargo-photos', 'site-assets'));

CREATE POLICY "Admin can upload cargo photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cargo-photos' AND is_admin());

CREATE POLICY "Admin can upload site assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-assets' AND is_admin());

CREATE POLICY "Admin can delete site assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'site-assets' AND is_admin());

-- 11. ADD INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_cargo_branch_id ON public.cargo(branch_id);
CREATE INDEX IF NOT EXISTS idx_cargo_status ON public.cargo(status);
CREATE INDEX IF NOT EXISTS idx_cargo_status_history_cargo_id ON public.cargo_status_history(cargo_id);
CREATE INDEX IF NOT EXISTS idx_cargo_preregistrations_track ON public.cargo_preregistrations(track_number);
CREATE INDEX IF NOT EXISTS idx_cargo_photos_cargo_id ON public.cargo_photos(cargo_id);