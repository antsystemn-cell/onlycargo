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

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_user_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < p_fee THEN
    RAISE EXCEPTION 'Хэтэвчний үлдэгдэл хүрэлцэхгүй байна';
  END IF;

  INSERT INTO public.product_research_orders (user_id, product_url, notes, fee, status)
  VALUES (v_user_id, p_product_url, p_notes, p_fee, 'pending')
  RETURNING id INTO v_order_id;

  IF p_fee > 0 THEN
    UPDATE public.wallets SET balance = balance - p_fee WHERE user_id = v_user_id;

    INSERT INTO public.wallet_transactions (wallet_id, user_id, amount, type, description, reference_id)
    SELECT id, v_user_id, -p_fee, 'debit', 'Барааны судалгааны төлбөр', v_order_id
    FROM public.wallets WHERE user_id = v_user_id
    RETURNING id INTO v_txn_id;

    UPDATE public.product_research_orders SET wallet_transaction_id = v_txn_id WHERE id = v_order_id;
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_research_order(text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_research_order(text, text, numeric) TO authenticated;