-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create cargo_status enum
CREATE TYPE public.cargo_status AS ENUM ('registered', 'in_transit', 'arrived_ub', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL UNIQUE,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create delivery_addresses table
CREATE TABLE public.delivery_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    address_line TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Улаанбаатар',
    district TEXT,
    phone TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cargo table
CREATE TABLE public.cargo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_number TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    weight DECIMAL(10, 2),
    length DECIMAL(10, 2),
    width DECIMAL(10, 2),
    height DECIMAL(10, 2),
    status cargo_status NOT NULL DEFAULT 'registered',
    status_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    price DECIMAL(10, 2),
    shelf_location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(track_number)
);

-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_global BOOLEAN NOT NULL DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_cargo_track_number ON public.cargo(track_number);
CREATE INDEX idx_cargo_phone_number ON public.cargo(phone_number);
CREATE INDEX idx_cargo_user_id ON public.cargo(user_id);
CREATE INDEX idx_cargo_status ON public.cargo(status);
CREATE INDEX idx_delivery_addresses_user_id ON public.delivery_addresses(user_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Create function to get user phone from profile
CREATE OR REPLACE FUNCTION public.get_user_phone()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT phone FROM public.profiles WHERE id = auth.uid()
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Only admins can insert roles"
    ON public.user_roles FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete roles"
    ON public.user_roles FOR DELETE
    USING (public.is_admin());

-- RLS Policies for delivery_addresses
CREATE POLICY "Users can view own addresses"
    ON public.delivery_addresses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own addresses"
    ON public.delivery_addresses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
    ON public.delivery_addresses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
    ON public.delivery_addresses FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for cargo
CREATE POLICY "Users can view own cargo by phone"
    ON public.cargo FOR SELECT
    USING (
        phone_number = public.get_user_phone()
        OR user_id = auth.uid()
        OR public.is_admin()
    );

CREATE POLICY "Admins can insert cargo"
    ON public.cargo FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update cargo"
    ON public.cargo FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete cargo"
    ON public.cargo FOR DELETE
    USING (public.is_admin());

-- RLS Policies for notifications
CREATE POLICY "Users can view own or global notifications"
    ON public.notifications FOR SELECT
    USING (
        is_global = true
        OR user_id = auth.uid()
        OR public.is_admin()
    );

CREATE POLICY "Admins can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update notifications"
    ON public.notifications FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete notifications"
    ON public.notifications FOR DELETE
    USING (public.is_admin());

-- Create view for public cargo search (hides sensitive info)
CREATE VIEW public.cargo_public AS
SELECT 
    id,
    track_number,
    status,
    status_date,
    created_at
FROM public.cargo;

-- Function to handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    phone_from_email TEXT;
BEGIN
    -- Extract phone from email (format: phone@cargo.local)
    phone_from_email := SPLIT_PART(NEW.email, '@', 1);
    
    -- Insert profile
    INSERT INTO public.profiles (id, phone)
    VALUES (NEW.id, phone_from_email);
    
    -- Assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Link any existing cargo with this phone number
    UPDATE public.cargo
    SET user_id = NEW.id
    WHERE phone_number = phone_from_email AND user_id IS NULL;
    
    RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cargo_updated_at
    BEFORE UPDATE ON public.cargo
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_addresses_updated_at
    BEFORE UPDATE ON public.delivery_addresses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();