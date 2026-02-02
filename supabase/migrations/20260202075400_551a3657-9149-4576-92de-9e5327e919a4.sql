-- Create user_branches junction table for many-to-many relationship
CREATE TABLE public.user_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;

-- Users can view their own branch assignments
CREATE POLICY "Users can view own branch assignments"
ON public.user_branches
FOR SELECT
USING (auth.uid() = user_id OR is_admin());

-- Only admins can manage branch assignments
CREATE POLICY "Admins can manage branch assignments"
ON public.user_branches
FOR ALL
USING (is_admin());

-- Create index for performance
CREATE INDEX idx_user_branches_user_id ON public.user_branches(user_id);
CREATE INDEX idx_user_branches_branch_id ON public.user_branches(branch_id);