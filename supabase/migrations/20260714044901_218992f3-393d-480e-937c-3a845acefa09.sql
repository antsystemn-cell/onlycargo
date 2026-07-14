CREATE TYPE public.customs_consultation_status AS ENUM ('pending', 'processing', 'completed', 'rejected', 'cancelled');

CREATE TABLE public.customs_consultation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_description text NOT NULL,
  product_value numeric,
  quantity numeric,
  contact_phone text,
  notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  fee numeric NOT NULL DEFAULT 0,
  status public.customs_consultation_status NOT NULL DEFAULT 'pending',
  admin_quoted_cost numeric,
  admin_response text,
  admin_notes text,
  wallet_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customs_consultation_orders TO authenticated;
GRANT ALL ON public.customs_consultation_orders TO service_role;

ALTER TABLE public.customs_consultation_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own customs orders"
  ON public.customs_consultation_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users create own customs orders"
  ON public.customs_consultation_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cancel own pending customs orders"
  ON public.customs_consultation_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'cancelled'));

CREATE POLICY "Admins manage all customs orders"
  ON public.customs_consultation_orders FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER update_customs_consultation_orders_updated_at
  BEFORE UPDATE ON public.customs_consultation_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_customs_orders_user ON public.customs_consultation_orders(user_id, created_at DESC);
CREATE INDEX idx_customs_orders_status ON public.customs_consultation_orders(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_customs_consultation_order(
  p_product_description text,
  p_product_value numeric,
  p_quantity numeric,
  p_contact_phone text,
  p_notes text,
  p_attachments jsonb,
  p_fee numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_new_balance numeric;
  v_wallet_id uuid;
  v_order_id uuid;
  v_txn_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Нэвтэрсэн байх шаардлагатай';
  END IF;

  IF p_product_description IS NULL OR length(trim(p_product_description)) = 0 THEN
    RAISE EXCEPTION 'Барааны тайлбар заавал шаардлагатай';
  END IF;

  IF p_fee IS NULL OR p_fee < 0 THEN
    RAISE EXCEPTION 'Төлбөрийн дүн буруу';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;

  IF v_balance < p_fee THEN
    RAISE EXCEPTION 'Хэтэвчний үлдэгдэл хүрэлцэхгүй байна';
  END IF;

  INSERT INTO public.customs_consultation_orders (
    user_id, product_description, product_value, quantity,
    contact_phone, notes, attachments, fee, status
  ) VALUES (
    v_user_id, p_product_description, p_product_value, p_quantity,
    p_contact_phone, p_notes, COALESCE(p_attachments, '[]'::jsonb), p_fee, 'pending'
  ) RETURNING id INTO v_order_id;

  IF p_fee > 0 THEN
    v_new_balance := v_balance - p_fee;
    UPDATE public.wallets SET balance = v_new_balance WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, balance_after,
      reference_id, reference_type, description
    ) VALUES (
      v_wallet_id, v_user_id, 'debit', -p_fee, v_new_balance,
      v_order_id, 'customs_consultation',
      'Гаалийн зөвлөгөөний төлбөр'
    ) RETURNING id INTO v_txn_id;

    UPDATE public.customs_consultation_orders SET wallet_transaction_id = v_txn_id WHERE id = v_order_id;
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customs_consultation_order(text, numeric, numeric, text, text, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customs_consultation_order(text, numeric, numeric, text, text, jsonb, numeric) TO authenticated;