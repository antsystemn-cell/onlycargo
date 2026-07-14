CREATE TYPE public.product_research_status AS ENUM ('pending', 'processing', 'completed', 'rejected', 'cancelled');

CREATE TABLE public.product_research_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_url text NOT NULL,
  notes text,
  fee numeric NOT NULL DEFAULT 0,
  status public.product_research_status NOT NULL DEFAULT 'pending',
  admin_quoted_price numeric,
  admin_response text,
  admin_notes text,
  wallet_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_research_orders TO authenticated;
GRANT ALL ON public.product_research_orders TO service_role;

ALTER TABLE public.product_research_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own research orders"
  ON public.product_research_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users create own research orders"
  ON public.product_research_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cancel own pending orders"
  ON public.product_research_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Admins manage all research orders"
  ON public.product_research_orders FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER update_product_research_orders_updated_at
  BEFORE UPDATE ON public.product_research_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_research_orders_user ON public.product_research_orders(user_id, created_at DESC);
CREATE INDEX idx_product_research_orders_status ON public.product_research_orders(status, created_at DESC);