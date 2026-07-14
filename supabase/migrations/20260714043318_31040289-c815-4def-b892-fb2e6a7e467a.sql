
CREATE TYPE public.remittance_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'rejected');
CREATE TYPE public.remittance_receiver_type AS ENUM ('alipay', 'wechat');

CREATE TABLE public.remittance_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_mnt NUMERIC(14,2) NOT NULL CHECK (amount_mnt > 0),
  amount_cny NUMERIC(14,2) NOT NULL CHECK (amount_cny > 0),
  rate NUMERIC(10,4) NOT NULL CHECK (rate > 0),
  fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  receiver_type public.remittance_receiver_type NOT NULL,
  receiver_account TEXT NOT NULL,
  receiver_name TEXT NOT NULL,
  note TEXT,
  status public.remittance_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  proof_url TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_remittance_orders_user ON public.remittance_orders(user_id, created_at DESC);
CREATE INDEX idx_remittance_orders_status ON public.remittance_orders(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.remittance_orders TO authenticated;
GRANT ALL ON public.remittance_orders TO service_role;

ALTER TABLE public.remittance_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own remittance orders"
  ON public.remittance_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own remittance orders"
  ON public.remittance_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own pending remittance orders"
  ON public.remittance_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Admins can update all remittance orders"
  ON public.remittance_orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_remittance_orders_updated_at
  BEFORE UPDATE ON public.remittance_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
