-- ==============================================
-- PART 2: Add new roles to app_role enum
-- ==============================================

-- Add new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'china_warehouse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'branch_admin';