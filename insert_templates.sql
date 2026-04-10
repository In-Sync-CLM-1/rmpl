-- Clear old templates from previous WABA
DELETE FROM whatsapp_templates;

-- Insert templates from new WABA
INSERT INTO whatsapp_templates (template_id, template_name, category, language, content, buttons, variables, sample_values, status, created_by_portal, last_synced_at)
VALUES
('1464284458687286', 'vendor_verification', 'MARKETING', 'en',
 'Hi {{1}}, I am Amit, founder of In-Sync. Are your vendors verified?',
 '[{"type": "URL", "text": "Try it yourself", "url": "https://civ.in-sync.co.in/"}]'::jsonb,
 '[{"index": 1, "placeholder": "{{1}}"}]'::jsonb,
 '{}'::jsonb,
 'approved', true, NOW()),

('871639275500568', 'otp', 'AUTHENTICATION', 'en',
 '*{{1}}* is your verification code. For your security, do not share this code.',
 '[{"type": "URL", "text": "Copy code", "url": "https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=otp{{1}}"}]'::jsonb,
 '[{"index": 1, "placeholder": "{{1}}"}]'::jsonb,
 '{}'::jsonb,
 'approved', true, NOW()),

('818178203976394', 'introduction', 'MARKETING', 'en',
 'Namaste. Field team intro message with free trial link.',
 '[{"type": "URL", "text": "Click here for free trial", "url": "https://wa.in-sync.co.in/"}]'::jsonb,
 '[]'::jsonb, '{}'::jsonb,
 'approved', true, NOW()),

('3726127990860906', 'reminder_salesforce__appstrail_webinar', 'MARKETING', 'en',
 'Greetings from Salesforce and Appstrail webinar reminder',
 '[{"type": "QUICK_REPLY", "text": "Yes"}, {"type": "QUICK_REPLY", "text": "No"}]'::jsonb,
 '[]'::jsonb, '{}'::jsonb,
 'approved', true, NOW()),

('1200511435627393', 'vendor_registration', 'MARKETING', 'en',
 'Hello {{1}} Greetings from {{2}}, Your vendor registration link is given below.',
 '[]'::jsonb,
 '[{"index": 1, "placeholder": "{{1}}"}, {"index": 2, "placeholder": "{{2}}"}]'::jsonb,
 '{}'::jsonb,
 'approved', true, NOW());

SELECT template_name, status FROM whatsapp_templates ORDER BY template_name;
