-- Drop the existing BEFORE INSERT trigger that causes the FK constraint issue
DROP TRIGGER IF EXISTS match_preregistration_trigger ON public.cargo;

-- Recreate the function to work correctly as an AFTER INSERT trigger
CREATE OR REPLACE FUNCTION public.match_preregistration_on_cargo_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  prereg_record RECORD;
BEGIN
  -- Find matching preregistration by track number
  SELECT * INTO prereg_record
  FROM public.cargo_preregistrations
  WHERE track_number = NEW.track_number
    AND matched_cargo_id IS NULL
  LIMIT 1;

  -- If found, update both tables
  IF prereg_record.id IS NOT NULL THEN
    -- Update preregistration with matched cargo (cargo now exists since this is AFTER INSERT)
    UPDATE public.cargo_preregistrations
    SET matched_cargo_id = NEW.id
    WHERE id = prereg_record.id;

    -- If cargo doesn't have user_id, link it from preregistration
    IF NEW.user_id IS NULL THEN
      UPDATE public.cargo
      SET user_id = prereg_record.user_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create as AFTER INSERT trigger instead of BEFORE INSERT
CREATE TRIGGER match_preregistration_trigger
  AFTER INSERT ON public.cargo
  FOR EACH ROW
  EXECUTE FUNCTION public.match_preregistration_on_cargo_insert();

-- Also add a china_warehouse role policy for cargo insertion
DROP POLICY IF EXISTS "China warehouse can insert cargo" ON public.cargo;
CREATE POLICY "China warehouse can insert cargo"
  ON public.cargo
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'china_warehouse') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Allow china_warehouse to update cargo they registered
DROP POLICY IF EXISTS "China warehouse can update own registered cargo" ON public.cargo;
CREATE POLICY "China warehouse can update own registered cargo"
  ON public.cargo
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'china_warehouse') AND registered_by = auth.uid()
  );

-- Allow china_warehouse to upload photos
DROP POLICY IF EXISTS "China warehouse can upload photos" ON public.cargo_photos;
CREATE POLICY "China warehouse can upload photos"
  ON public.cargo_photos
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'china_warehouse') OR
    public.has_role(auth.uid(), 'admin')
  );