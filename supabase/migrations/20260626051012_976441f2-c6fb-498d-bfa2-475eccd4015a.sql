
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS verified_phone text,
  ADD COLUMN IF NOT EXISTS verified_phone_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_phone text,
  ADD COLUMN IF NOT EXISTS pending_otp_hash text,
  ADD COLUMN IF NOT EXISTS pending_otp_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_otp_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_otp_last_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.api_key_otp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  phone text NOT NULL,
  event text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_key_otp_logs TO authenticated;
GRANT ALL ON public.api_key_otp_logs TO service_role;

ALTER TABLE public.api_key_otp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view OTP logs"
  ON public.api_key_otp_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_api_key_otp_logs_key ON public.api_key_otp_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_verified_phone ON public.api_keys(verified_phone);
