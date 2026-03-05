-- Add rate limiting columns to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN emails_per_minute integer DEFAULT 20,
ADD COLUMN delay_between_emails_ms integer DEFAULT 3000;

-- Add index for better query performance on campaign status
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

COMMENT ON COLUMN public.campaigns.emails_per_minute IS 'Maximum emails to send per minute (10=slow, 20=medium, 40=fast)';
COMMENT ON COLUMN public.campaigns.delay_between_emails_ms IS 'Delay in milliseconds between each email send';