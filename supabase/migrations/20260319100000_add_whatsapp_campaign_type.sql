-- Allow WhatsApp as a campaign type alongside email
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check CHECK (type IN ('email', 'whatsapp'));
