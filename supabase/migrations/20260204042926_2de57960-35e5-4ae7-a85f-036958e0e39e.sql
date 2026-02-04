-- Fix RLS policy for wallet_topups to be more secure
DROP POLICY IF EXISTS "Service role can update topups" ON public.wallet_topups;

-- Edge functions use service role key which bypasses RLS
-- But we add a restrictive policy for regular users
CREATE POLICY "Users cannot directly update topups"
  ON public.wallet_topups
  FOR UPDATE
  USING (false)
  WITH CHECK (false);