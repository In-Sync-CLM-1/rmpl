-- Add policy to allow authenticated users to view all profiles for team selection
-- This is needed so users can see all team members when assigning project teams

CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);