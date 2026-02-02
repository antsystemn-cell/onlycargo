-- Fix storage policy for cargo-photos to allow china_warehouse role to upload
DROP POLICY IF EXISTS "Admin can upload cargo photos" ON storage.objects;

CREATE POLICY "Staff can upload cargo photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'cargo-photos' 
  AND (is_admin() OR has_role(auth.uid(), 'china_warehouse'::app_role))
);

-- Add SELECT policy for china_warehouse to view cargo (needed for duplicate checking)
DROP POLICY IF EXISTS "Users can view own cargo by phone" ON public.cargo;

CREATE POLICY "Users and staff can view cargo" ON public.cargo
FOR SELECT USING (
  phone_number = get_user_phone() 
  OR user_id = auth.uid() 
  OR is_admin()
  OR has_role(auth.uid(), 'china_warehouse'::app_role)
  OR has_role(auth.uid(), 'branch_admin'::app_role)
);

-- Add branch_admin role to cargo insert policy
DROP POLICY IF EXISTS "China warehouse can insert cargo" ON public.cargo;

CREATE POLICY "Staff can insert cargo" ON public.cargo
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'china_warehouse'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'branch_admin'::app_role)
);

-- Add branch_admin to update policy  
DROP POLICY IF EXISTS "China warehouse can update own registered cargo" ON public.cargo;

CREATE POLICY "Staff can update own registered cargo" ON public.cargo
FOR UPDATE USING (
  (has_role(auth.uid(), 'china_warehouse'::app_role) AND registered_by = auth.uid())
  OR (has_role(auth.uid(), 'branch_admin'::app_role) AND registered_by = auth.uid())
  OR is_admin()
);

-- Add policy for china_warehouse and branch_admin to upload to cargo_photos table
DROP POLICY IF EXISTS "China warehouse can upload photos" ON public.cargo_photos;

CREATE POLICY "Staff can upload cargo photos to table" ON public.cargo_photos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'china_warehouse'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'branch_admin'::app_role)
);