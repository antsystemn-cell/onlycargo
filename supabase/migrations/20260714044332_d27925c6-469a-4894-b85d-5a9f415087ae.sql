CREATE OR REPLACE FUNCTION public.create_product_research_order(
  p_product_url text,
  p_notes text,
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

  IF p_product_url IS NULL OR length(trim(p_product_url)) = 0 THEN
    RAISE EXCEPTION 'Барааны линк заавал шаардлагатай';
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

  INSERT INTO public.product_research_orders (user_id, product_url, notes, fee, status)
  VALUES (v_user_id, p_product_url, p_notes, p_fee, 'pending')
  RETURNING id INTO v_order_id;

  IF p_fee > 0 THEN
    v_new_balance := v_balance - p_fee;
    UPDATE public.wallets SET balance = v_new_balance WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, type, amount, balance_after,
      reference_id, reference_type, description
    ) VALUES (
      v_wallet_id, v_user_id, 'debit', -p_fee, v_new_balance,
      v_order_id, 'product_research',
      'Барааны судалгааны төлбөр'
    ) RETURNING id INTO v_txn_id;

    UPDATE public.product_research_orders SET wallet_transaction_id = v_txn_id WHERE id = v_order_id;
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_research_order(text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_research_order(text, text, numeric) TO authenticated;