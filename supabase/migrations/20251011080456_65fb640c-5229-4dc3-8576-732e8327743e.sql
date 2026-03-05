-- Create inbound_sms table to store all incoming SMS messages
CREATE TABLE public.inbound_sms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_number text NOT NULL,
  to_number text NOT NULL,
  message_text text NOT NULL,
  message_uuid text, -- Plivo's unique message ID
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  is_opt_out boolean DEFAULT false,
  received_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_inbound_sms_from_number ON public.inbound_sms(from_number);
CREATE INDEX idx_inbound_sms_campaign_id ON public.inbound_sms(campaign_id);
CREATE INDEX idx_inbound_sms_candidate_id ON public.inbound_sms(candidate_id);
CREATE INDEX idx_inbound_sms_received_at ON public.inbound_sms(received_at DESC);

-- Enable RLS
ALTER TABLE public.inbound_sms ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view inbound SMS"
  ON public.inbound_sms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage inbound SMS"
  ON public.inbound_sms FOR ALL
  TO authenticated
  USING (true);

-- Add is_unsubscribed column to candidates table
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS is_unsubscribed boolean DEFAULT false;

-- Add index for filtering unsubscribed candidates
CREATE INDEX idx_candidates_is_unsubscribed ON public.candidates(is_unsubscribed);

-- Enable realtime for inbound_sms table
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_sms;