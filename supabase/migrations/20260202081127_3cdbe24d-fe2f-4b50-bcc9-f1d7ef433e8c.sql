-- Create trigger function to log initial cargo registration status
CREATE OR REPLACE FUNCTION public.log_initial_cargo_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cargo_status_history (cargo_id, status, changed_by, notes)
  VALUES (NEW.id, NEW.status, auth.uid(), 'Анх бүртгэсэн');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new cargo insertions
CREATE TRIGGER log_cargo_initial_status
AFTER INSERT ON public.cargo
FOR EACH ROW
EXECUTE FUNCTION public.log_initial_cargo_status();

-- Backfill: Add initial 'registered' status for cargo that have no history
INSERT INTO public.cargo_status_history (cargo_id, status, changed_by, notes, created_at)
SELECT 
  c.id, 
  'registered'::cargo_status, 
  c.registered_by, 
  'Анх бүртгэсэн',
  c.created_at
FROM public.cargo c
WHERE NOT EXISTS (
  SELECT 1 FROM public.cargo_status_history csh 
  WHERE csh.cargo_id = c.id AND csh.status = 'registered'
);