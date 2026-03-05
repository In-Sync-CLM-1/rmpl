-- Add a permissive SELECT policy for all authenticated users to view profiles (for joins in other tables)
CREATE POLICY "Profiles are viewable by all authenticated users for joins"
  ON public.profiles
  FOR SELECT
  USING (true);
