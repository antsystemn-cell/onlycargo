-- Fix the security definer view issue by using security_invoker
DROP VIEW IF EXISTS public.cargo_public;

CREATE VIEW public.cargo_public
WITH (security_invoker = on) AS
SELECT 
    id,
    track_number,
    status,
    status_date,
    created_at
FROM public.cargo;

-- Fix the function search path issue for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;