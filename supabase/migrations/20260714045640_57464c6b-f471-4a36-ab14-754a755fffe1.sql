
CREATE TABLE public.china_domestic_transport_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_city TEXT NOT NULL,
  origin_address TEXT,
  destination_city TEXT NOT NULL,
  destination_address TEXT,
  goods_description TEXT NOT NULL,
  goods_quantity TEXT,
  goods_weight TEXT,
  goods_volume TEXT,
  contact_phone TEXT,
  notes TEXT,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  quoted_price NUMERIC,
  admin_response TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.china_domestic_transport_orders TO authenticated;
GRANT ALL ON public.china_domestic_transport_orders TO service_role;

ALTER TABLE public.china_domestic_transport_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View china transport orders"
ON public.china_domestic_transport_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_admin() OR has_role(auth.uid(), 'china_warehouse'::app_role));

CREATE POLICY "Insert own china transport orders"
ON public.china_domestic_transport_orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update china transport orders"
ON public.china_domestic_transport_orders FOR UPDATE TO authenticated
USING (is_admin() OR has_role(auth.uid(), 'china_warehouse'::app_role))
WITH CHECK (is_admin() OR has_role(auth.uid(), 'china_warehouse'::app_role));

CREATE POLICY "Users cancel own china transport orders"
ON public.china_domestic_transport_orders FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

CREATE TRIGGER update_china_domestic_transport_orders_updated_at
BEFORE UPDATE ON public.china_domestic_transport_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.site_settings (key, value)
VALUES
  ('china_domestic_transport_enabled', 'true'::jsonb),
  ('china_domestic_transport_fee', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_china_domestic_transport_order(
  _origin_city TEXT,
  _origin_address TEXT,
  _destination_city TEXT,
  _destination_address TEXT,
  _goods_description TEXT,
  _goods_quantity TEXT,
  _goods_weight TEXT,
  _goods_volume TEXT,
  _contact_phone TEXT,
  _notes TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _fee NUMERIC;
  _balance NUMERIC;
  _order_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT (value)::text::numeric INTO _fee
  FROM site_settings WHERE key = 'china_domestic_transport_fee';
  IF _fee IS NULL THEN _fee := 0; END IF;

  IF _fee > 0 THEN
    SELECT balance INTO _balance FROM wallets WHERE user_id = _uid FOR UPDATE;
    IF _balance IS NULL OR _balance < _fee THEN
      RAISE EXCEPTION 'insufficient_balance';
    END IF;

    UPDATE wallets SET balance = balance - _fee WHERE user_id = _uid;

    INSERT INTO wallet_transactions (user_id, amount, type, description)
    VALUES (_uid, -_fee, 'debit', 'Хятадын дотоод тээврийн үйлчилгээний хураамж');
  END IF;

  INSERT INTO china_domestic_transport_orders(
    user_id, origin_city, origin_address, destination_city, destination_address,
    goods_description, goods_quantity, goods_weight, goods_volume,
    contact_phone, notes, fee_amount
  )
  VALUES (
    _uid, _origin_city, _origin_address, _destination_city, _destination_address,
    _goods_description, _goods_quantity, _goods_weight, _goods_volume,
    _contact_phone, _notes, _fee
  )
  RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$$;
