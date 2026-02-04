-- =====================================================
-- PHASE 1: Branch Pricing & China Address Configuration
-- =====================================================

-- Add pricing and China address fields to branches table
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS weight_rate numeric DEFAULT 2500,
ADD COLUMN IF NOT EXISTS volume_rate numeric DEFAULT 312000,
ADD COLUMN IF NOT EXISTS china_address_prefix text DEFAULT 'ONLY',
ADD COLUMN IF NOT EXISTS china_address_text text DEFAULT '收货人: 唯一OnlyCargo
手机号码: 13694788211
所在地区: 内蒙古，锡林郭勒盟，二连浩特市, 肯特街
详细地址: 白音布日特物流巴图收';

-- =====================================================
-- PHASE 2: Delivery Zones & Addresses
-- =====================================================

-- Create delivery zones table
CREATE TABLE public.delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    description text,
    polygon jsonb, -- GeoJSON polygon for map-based detection
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- RLS policies for delivery zones
CREATE POLICY "Anyone can view active delivery zones"
ON public.delivery_zones FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage delivery zones"
ON public.delivery_zones FOR ALL
USING (is_admin());

-- Insert default zones
INSERT INTO public.delivery_zones (name, code, price, description, sort_order) VALUES
('A бүс', 'ZONE_A', 5000, 'Хотын төв', 1),
('B бүс', 'ZONE_B', 10000, 'Дүүргийн төв', 2),
('C бүс', 'ZONE_C', 15000, 'Хотын захын бүс', 3);

-- =====================================================
-- PHASE 3: Delivery Orders
-- =====================================================

-- Create delivery orders table
CREATE TABLE public.delivery_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    payment_id uuid REFERENCES public.payments(id),
    delivery_type text NOT NULL CHECK (delivery_type IN ('self_pickup', 'delivery')),
    delivery_zone_id uuid REFERENCES public.delivery_zones(id),
    delivery_address_id uuid REFERENCES public.delivery_addresses(id),
    map_coordinates jsonb, -- {lat, lng}
    delivery_price numeric DEFAULT 0,
    cargo_price numeric NOT NULL DEFAULT 0,
    total_price numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'delivering', 'completed', 'cancelled')),
    pickup_deadline timestamptz, -- 14 days from ready status
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create delivery order items (cargo in order)
CREATE TABLE public.delivery_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id uuid NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
    cargo_id uuid NOT NULL REFERENCES public.cargo(id),
    price numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for delivery orders
CREATE POLICY "Users can view own delivery orders"
ON public.delivery_orders FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create own delivery orders"
ON public.delivery_orders FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all delivery orders"
ON public.delivery_orders FOR ALL
USING (is_admin());

CREATE POLICY "Users can view own delivery order items"
ON public.delivery_order_items FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.delivery_orders d 
    WHERE d.id = delivery_order_items.delivery_order_id 
    AND (d.user_id = auth.uid() OR is_admin())
));

CREATE POLICY "Users can create own delivery order items"
ON public.delivery_order_items FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.delivery_orders d 
    WHERE d.id = delivery_order_items.delivery_order_id 
    AND d.user_id = auth.uid()
));

CREATE POLICY "Admins can manage delivery order items"
ON public.delivery_order_items FOR ALL
USING (is_admin());

-- =====================================================
-- PHASE 4: China Shipments
-- =====================================================

-- Create shipments table for batch loading
CREATE TABLE public.shipments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number text UNIQUE NOT NULL,
    loaded_by uuid NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    cargo_count integer NOT NULL DEFAULT 0,
    total_weight numeric DEFAULT 0,
    notes text,
    status text NOT NULL DEFAULT 'loaded' CHECK (status IN ('loaded', 'in_transit', 'arrived', 'completed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create shipment items
CREATE TABLE public.shipment_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    cargo_id uuid NOT NULL REFERENCES public.cargo(id),
    added_at timestamptz NOT NULL DEFAULT now()
);

-- Add shipment_id to cargo
ALTER TABLE public.cargo
ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id);

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipments
CREATE POLICY "Staff can view shipments"
ON public.shipments FOR SELECT
USING (is_admin() OR has_role(auth.uid(), 'china_warehouse'::app_role));

CREATE POLICY "China staff can create shipments"
ON public.shipments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'china_warehouse'::app_role) OR is_admin());

CREATE POLICY "Admins can manage shipments"
ON public.shipments FOR ALL
USING (is_admin());

CREATE POLICY "Staff can view shipment items"
ON public.shipment_items FOR SELECT
USING (is_admin() OR has_role(auth.uid(), 'china_warehouse'::app_role));

CREATE POLICY "Staff can insert shipment items"
ON public.shipment_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'china_warehouse'::app_role) OR is_admin());

CREATE POLICY "Admins can manage shipment items"
ON public.shipment_items FOR ALL
USING (is_admin());

-- =====================================================
-- PHASE 5: Wallet System
-- =====================================================

-- Create wallets table
CREATE TABLE public.wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE NOT NULL,
    balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create wallet transactions table
CREATE TABLE public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid NOT NULL REFERENCES public.wallets(id),
    user_id uuid NOT NULL,
    type text NOT NULL CHECK (type IN ('topup', 'payment', 'refund', 'referral_reward', 'admin_adjustment')),
    amount numeric NOT NULL,
    balance_after numeric NOT NULL,
    reference_id uuid, -- payment_id, delivery_order_id, etc.
    reference_type text, -- 'payment', 'delivery_order', 'topup', 'referral'
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for wallets
CREATE POLICY "Users can view own wallet"
ON public.wallets FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can create wallets"
ON public.wallets FOR INSERT
WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage wallets"
ON public.wallets FOR ALL
USING (is_admin());

CREATE POLICY "Users can view own wallet transactions"
ON public.wallet_transactions FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admins can manage wallet transactions"
ON public.wallet_transactions FOR ALL
USING (is_admin());

-- =====================================================
-- PHASE 6: Referral & Coupon System
-- =====================================================

-- Create referral codes table
CREATE TABLE public.referral_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE NOT NULL,
    code text UNIQUE NOT NULL,
    uses_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create referrals tracking table
CREATE TABLE public.referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid NOT NULL,
    referred_id uuid UNIQUE NOT NULL,
    referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
    reward_amount numeric,
    reward_paid boolean NOT NULL DEFAULT false,
    reward_paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create coupons table
CREATE TABLE public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value numeric NOT NULL,
    min_order_amount numeric DEFAULT 0,
    max_uses integer,
    uses_count integer NOT NULL DEFAULT 0,
    expires_at timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create coupon usage tracking
CREATE TABLE public.coupon_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id),
    user_id uuid NOT NULL,
    order_id uuid, -- delivery_order_id
    discount_applied numeric NOT NULL,
    used_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own referral code"
ON public.referral_codes FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can create own referral code"
ON public.referral_codes FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT
USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR is_admin());

CREATE POLICY "System can create referrals"
ON public.referrals FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage referrals"
ON public.referrals FOR ALL
USING (is_admin());

CREATE POLICY "Anyone can view active coupons"
ON public.coupons FOR SELECT
USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL
USING (is_admin());

CREATE POLICY "Users can view own coupon usage"
ON public.coupon_usage FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can create coupon usage"
ON public.coupon_usage FOR INSERT
WITH CHECK (user_id = auth.uid() OR is_admin());

-- =====================================================
-- PHASE 7: Site Settings for Referral & Delivery
-- =====================================================

-- Add referral and delivery settings
INSERT INTO public.site_settings (key, value) VALUES
('referral_reward_amount', '5000'),
('pickup_storage_notice', '"Хэрэв таны ачаа Агуулахад бэлэн болсноос хойш 14 хоногийн дотор аваагүй бол хадгалалтын төлбөр тооцогдоно."'),
('delivery_policy_notice', '"Хүргэлтийн үнэ нь бүсээс хамаарна. А бүс - 5000₮, B бүс - 10000₮, C бүс - 15000₮"')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- PHASE 8: Helper Functions
-- =====================================================

-- Function to calculate cargo price using MAX logic
CREATE OR REPLACE FUNCTION public.calculate_cargo_price(
    p_weight numeric,
    p_length numeric,
    p_width numeric,
    p_height numeric,
    p_weight_rate numeric DEFAULT 2500,
    p_volume_rate numeric DEFAULT 312000
)
RETURNS TABLE (
    weight_price numeric,
    volume_price numeric,
    final_price numeric,
    cubic_meters numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_cubic_meters numeric;
    v_weight_price numeric;
    v_volume_price numeric;
BEGIN
    -- Calculate cubic meters
    v_cubic_meters := COALESCE(p_length, 0) * COALESCE(p_width, 0) * COALESCE(p_height, 0) / 1000000.0;
    
    -- Calculate prices
    v_weight_price := COALESCE(p_weight, 0) * p_weight_rate;
    v_volume_price := v_cubic_meters * p_volume_rate;
    
    -- Return MAX of the two prices
    RETURN QUERY SELECT 
        v_weight_price,
        v_volume_price,
        GREATEST(v_weight_price, v_volume_price),
        v_cubic_meters;
END;
$$;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code text;
    v_phone text;
BEGIN
    -- Get user's phone
    SELECT phone INTO v_phone FROM public.profiles WHERE id = p_user_id;
    
    -- Generate code: ONLY + last 4 digits of phone + random 2 chars
    v_code := 'ONLY' || RIGHT(v_phone, 4) || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 2));
    
    RETURN v_code;
END;
$$;

-- Trigger to auto-create wallet for new users
CREATE OR REPLACE FUNCTION public.create_user_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_wallet_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_user_wallet();

-- Add updated_at triggers
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_orders_updated_at
BEFORE UPDATE ON public.delivery_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_zones_updated_at
BEFORE UPDATE ON public.delivery_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();