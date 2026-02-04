-- Create wallet_topups table for tracking QPay wallet top-ups
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  qpay_invoice_id TEXT,
  qpay_qr_text TEXT,
  qpay_qr_image TEXT,
  qpay_urls JSONB,
  invoice_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

-- Users can view their own topups
CREATE POLICY "Users can view own topups"
  ON public.wallet_topups
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own topups
CREATE POLICY "Users can create own topups"
  ON public.wallet_topups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only service role can update topups (edge functions)
CREATE POLICY "Service role can update topups"
  ON public.wallet_topups
  FOR UPDATE
  USING (true);

-- Admins can view all topups
CREATE POLICY "Admins can view all topups"
  ON public.wallet_topups
  FOR SELECT
  USING (public.is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_wallet_topups_updated_at
  BEFORE UPDATE ON public.wallet_topups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_wallet_topups_user_id ON public.wallet_topups(user_id);
CREATE INDEX idx_wallet_topups_wallet_id ON public.wallet_topups(wallet_id);
CREATE INDEX idx_wallet_topups_status ON public.wallet_topups(status);