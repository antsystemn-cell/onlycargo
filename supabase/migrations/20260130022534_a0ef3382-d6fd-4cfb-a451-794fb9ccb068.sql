-- Fix 1 & 2: Remove the overly permissive public SELECT policy
-- The cargo_public view already exists and safely exposes only non-sensitive fields
DROP POLICY IF EXISTS "Anyone can search cargo publicly" ON public.cargo;

-- Fix 3: Add server-side phone number validation via trigger
-- First, create a validation function for Mongolian phone numbers
CREATE OR REPLACE FUNCTION public.validate_phone_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow empty string (optional phone number in cargo registration)
  IF NEW.phone_number = '' THEN
    RETURN NEW;
  END IF;
  
  -- Validate Mongolian phone format: 8 digits starting with 6, 7, 8, or 9
  IF NEW.phone_number !~ '^[6-9][0-9]{7}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Must be 8 digits starting with 6, 7, 8, or 9.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for cargo table phone validation
DROP TRIGGER IF EXISTS validate_cargo_phone ON public.cargo;
CREATE TRIGGER validate_cargo_phone
  BEFORE INSERT OR UPDATE ON public.cargo
  FOR EACH ROW EXECUTE FUNCTION public.validate_phone_number();

-- Create similar validation for profiles table
CREATE OR REPLACE FUNCTION public.validate_profile_phone()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile phone is required, so validate format
  IF NEW.phone !~ '^[6-9][0-9]{7}$' THEN
    RAISE EXCEPTION 'Invalid phone number format. Must be 8 digits starting with 6, 7, 8, or 9.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for profiles table phone validation
DROP TRIGGER IF EXISTS validate_profile_phone ON public.profiles;
CREATE TRIGGER validate_profile_phone
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_phone();