-- Fix overly permissive RLS policy on referrals table
DROP POLICY IF EXISTS "System can create referrals" ON public.referrals;

CREATE POLICY "Users can create referrals for themselves"
ON public.referrals FOR INSERT
WITH CHECK (referred_id = auth.uid() OR is_admin());