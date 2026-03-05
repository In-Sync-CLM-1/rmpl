-- Add disposition and subdisposition fields to call_logs
ALTER TABLE public.call_logs 
ADD COLUMN IF NOT EXISTS disposition text,
ADD COLUMN IF NOT EXISTS subdisposition text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS disposition_set_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS disposition_set_at timestamptz;

-- Create a dispositions lookup table for standardization
CREATE TABLE IF NOT EXISTS public.call_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disposition text NOT NULL UNIQUE,
  subdispositions text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on call_dispositions
ALTER TABLE public.call_dispositions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can view dispositions
CREATE POLICY "Authenticated users can view dispositions"
  ON public.call_dispositions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Admins can manage dispositions
CREATE POLICY "Admins can manage dispositions"
  ON public.call_dispositions
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- RLS Policy: Users can update dispositions for their own calls
CREATE POLICY "Users can set disposition on calls they initiated"
  ON public.call_logs
  FOR UPDATE
  TO authenticated
  USING (initiated_by = auth.uid())
  WITH CHECK (initiated_by = auth.uid());

-- Insert standard dispositions including LTO
INSERT INTO public.call_dispositions (disposition, subdispositions) VALUES
  ('Connected', ARRAY['Interested', 'Not Interested', 'Needs More Info', 'Already a Customer', 'Follow Up Required']),
  ('Not Connected', ARRAY['No Answer', 'Voicemail', 'Phone Switched Off', 'Number Busy', 'Call Dropped']),
  ('LTO', ARRAY['Hot Lead', 'Warm Lead', 'Cold Lead', 'Nurture Required', 'High Value Opportunity']),
  ('Callback Requested', ARRAY['Call Back Today', 'Call Back Tomorrow', 'Call Back Next Week', 'Call Back Next Month']),
  ('Do Not Call', ARRAY['Requested Removal', 'Not Interested - Permanent', 'Invalid Contact']),
  ('Wrong Number', ARRAY['Wrong Person', 'Disconnected Number', 'Business Number']),
  ('Meeting Scheduled', ARRAY['Demo Scheduled', 'Consultation Scheduled', 'Follow-up Call Scheduled'])
ON CONFLICT (disposition) DO NOTHING;