
-- Add provider column to wallet_topups
ALTER TABLE public.wallet_topups 
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'qpay';

-- Add OmniWay-specific columns
ALTER TABLE public.wallet_topups 
ADD COLUMN IF NOT EXISTS omniway_invoice_number text,
ADD COLUMN IF NOT EXISTS omniway_qr_content text,
ADD COLUMN IF NOT EXISTS omniway_image_base64 text;

-- Index for looking up by omniway invoice number
CREATE INDEX IF NOT EXISTS idx_wallet_topups_omniway_invoice 
ON public.wallet_topups(omniway_invoice_number) WHERE omniway_invoice_number IS NOT NULL;

-- Index for provider
CREATE INDEX IF NOT EXISTS idx_wallet_topups_provider 
ON public.wallet_topups(provider);
