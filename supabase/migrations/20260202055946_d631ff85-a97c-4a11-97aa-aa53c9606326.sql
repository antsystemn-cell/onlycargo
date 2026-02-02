-- ============================================
-- BANNERS TABLE (Replace notifications on home)
-- ============================================
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Anyone can view enabled banners
CREATE POLICY "Anyone can view enabled banners"
ON public.banners
FOR SELECT
USING (is_enabled = true);

-- Admins can manage banners
CREATE POLICY "Admins can manage banners"
ON public.banners
FOR ALL
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_banners_updated_at
BEFORE UPDATE ON public.banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PAYMENTS TABLE (QPay Integration)
-- ============================================
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'refunded');
CREATE TYPE public.payment_method AS ENUM ('qpay', 'cash', 'bank_transfer', 'manual');

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  amount NUMERIC NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'qpay',
  status payment_status NOT NULL DEFAULT 'pending',
  qpay_invoice_id TEXT,
  qpay_qr_text TEXT,
  qpay_qr_image TEXT,
  qpay_urls JSONB,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view own payments
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
USING (user_id = auth.uid() OR is_admin());

-- Admins can manage all payments
CREATE POLICY "Admins can manage payments"
ON public.payments
FOR ALL
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PAYMENT-CARGO LINK TABLE (Many-to-Many)
-- ============================================
CREATE TABLE public.payment_cargo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  cargo_id UUID NOT NULL REFERENCES public.cargo(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (payment_id, cargo_id)
);

-- Enable RLS
ALTER TABLE public.payment_cargo ENABLE ROW LEVEL SECURITY;

-- Users can view links for their payments
CREATE POLICY "Users can view own payment cargo links"
ON public.payment_cargo
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_cargo.payment_id
    AND (p.user_id = auth.uid() OR is_admin())
  )
);

-- Admins can manage links
CREATE POLICY "Admins can manage payment cargo links"
ON public.payment_cargo
FOR ALL
USING (is_admin());

-- ============================================
-- ADD payment_id to cargo for quick lookup
-- ============================================
ALTER TABLE public.cargo ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id);

-- ============================================
-- Function to auto-transition preregistered cargo
-- ============================================
CREATE OR REPLACE FUNCTION public.match_preregistration_on_cargo_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- If found, update the preregistration and link user to cargo
  IF prereg_record.id IS NOT NULL THEN
    -- Update preregistration with matched cargo
    UPDATE public.cargo_preregistrations
    SET matched_cargo_id = NEW.id
    WHERE id = prereg_record.id;

    -- If cargo doesn't have user_id, set it from preregistration
    IF NEW.user_id IS NULL THEN
      NEW.user_id := prereg_record.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-matching
CREATE TRIGGER match_preregistration_trigger
BEFORE INSERT ON public.cargo
FOR EACH ROW
EXECUTE FUNCTION public.match_preregistration_on_cargo_insert();