
-- Cargo: merchant ownership + external ref
ALTER TABLE public.cargo
  ADD COLUMN IF NOT EXISTS merchant_id text,
  ADD COLUMN IF NOT EXISTS customer_code text,
  ADD COLUMN IF NOT EXISTS external_ref text;

CREATE INDEX IF NOT EXISTS idx_cargo_merchant_id ON public.cargo (merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cargo_customer_code ON public.cargo (customer_code) WHERE customer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cargo_external_ref ON public.cargo (external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cargo_status_status_date ON public.cargo (status, status_date DESC);
CREATE INDEX IF NOT EXISTS idx_cargo_branch_status_date ON public.cargo (branch_id, status_date DESC);
CREATE INDEX IF NOT EXISTS idx_cargo_track_number_trgm ON public.cargo (track_number);

-- Status history index
CREATE INDEX IF NOT EXISTS idx_csh_cargo_created ON public.cargo_status_history (cargo_id, created_at);

-- API keys: merchant scoping + last used tracking
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS merchant_id text,
  ADD COLUMN IF NOT EXISTS allowed_customer_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_ip text;

-- Usage logs index
CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON public.api_key_usage_logs (api_key_id, created_at DESC);
