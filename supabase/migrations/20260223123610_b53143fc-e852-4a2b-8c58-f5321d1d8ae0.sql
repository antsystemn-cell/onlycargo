
-- Add storepay fields to wallet_topups
ALTER TABLE public.wallet_topups
  ADD COLUMN IF NOT EXISTS storepay_loan_id text,
  ADD COLUMN IF NOT EXISTS storepay_request_id text,
  ADD COLUMN IF NOT EXISTS storepay_phone text;

-- Add storepay fields to payments table for cargo payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS storepay_loan_id text,
  ADD COLUMN IF NOT EXISTS storepay_request_id text,
  ADD COLUMN IF NOT EXISTS storepay_phone text;

-- Add 'storepay' to payment_method enum
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'storepay';
