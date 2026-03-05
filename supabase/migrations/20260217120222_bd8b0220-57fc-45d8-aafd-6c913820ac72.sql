DROP POLICY IF EXISTS "Anyone can submit onboarding forms" ON public.onboarding_submissions;

CREATE POLICY "Anyone can submit onboarding forms"
  ON public.onboarding_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);