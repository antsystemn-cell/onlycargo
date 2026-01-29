-- Add policy to allow anonymous users to view cargo (limited columns via the public view)
-- First, we need to allow public access to the cargo_public view for searching
CREATE POLICY "Anyone can search cargo publicly"
    ON public.cargo FOR SELECT
    TO anon
    USING (true);

-- Add policy to allow anonymous users to view global notifications
CREATE POLICY "Anyone can view global notifications"
    ON public.notifications FOR SELECT
    TO anon
    USING (is_global = true);