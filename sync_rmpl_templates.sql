-- Clear all templates and only insert RMPL-created ones + otp
DELETE FROM whatsapp_templates;

INSERT INTO whatsapp_templates (template_id, template_name, category, language, content, buttons, variables, sample_values, status, created_by_portal, last_synced_at) VALUES
-- Authentication
('871639275500568', 'otp', 'AUTHENTICATION', 'en',
 '*{{1}}* is your verification code. For your security, do not share this code.',
 '[{"type": "URL", "text": "Copy code", "url": "https://www.whatsapp.com/otp/code/?otp_type=COPY_CODE&code=otp{{1}}"}]'::jsonb,
 '[{"index": 1, "placeholder": "{{1}}"}]'::jsonb, '{}'::jsonb,
 'approved', true, NOW()),

-- HR & Attendance
('1928334211102200', 'leave_request_submitted', 'UTILITY', 'en',
 'Hi {{1}}, {{2}} has applied for {{3}} leave from {{4}} to {{5}}. Please review and approve/reject.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"},{"index":5,"placeholder":"{{5}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('813602854549585', 'leave_approved', 'UTILITY', 'en',
 'Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} has been approved. Approved by {{5}}. No further action is needed.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"},{"index":5,"placeholder":"{{5}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('796894466401242', 'leave_rejected', 'UTILITY', 'en',
 'Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} has been rejected. Rejected by {{5}}. Please contact your manager for more details.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"},{"index":5,"placeholder":"{{5}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('2726301867727324', 'regularization_submitted', 'UTILITY', 'en',
 'Hi {{1}}, {{2}} has submitted an attendance regularization request for {{3}}. Please review.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('2008714477191563', 'regularization_approved', 'UTILITY', 'en',
 'Hi {{1}}, your attendance regularization request for {{2}} has been approved by {{3}}. Your attendance has been updated.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('26602940886003721', 'regularization_rejected', 'UTILITY', 'en',
 'Hi {{1}}, your attendance regularization request for {{2}} has been rejected by {{3}}. Please contact your manager for details.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('2313491409061508', 'late_coming_alert', 'UTILITY', 'en',
 'Hi {{1}}, you signed in at {{2}} on {{3}} which is past the scheduled time. Please regularize if needed.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('954816443683951', 'salary_slip_ready', 'UTILITY', 'en',
 'Hi {{1}}, your salary slip for {{2}} is now available. Please log in to the portal to view and download it.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

-- Task & Project Management
('878733371849693', 'task_assigned', 'UTILITY', 'en',
 'Hi {{1}}, a new task has been assigned to you: *{{2}}*. Priority: {{3}}. Due date: {{4}}. Please log in to view details.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('1309637881036747', 'task_due_reminder', 'UTILITY', 'en',
 'Hi {{1}}, your task *{{2}}* is due in 24 hours ({{3}}). Please ensure it is completed on time.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('963092606666205', 'task_overdue', 'UTILITY', 'en',
 'Hi {{1}}, your task *{{2}}* was due on {{3}} and is now overdue. Please update the status.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('2015018406093194', 'task_completed_notification', 'UTILITY', 'en',
 'Hi {{1}}, the task *{{2}}* assigned to {{3}} has been marked as completed.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('1763986187898046', 'project_team_added', 'UTILITY', 'en',
 'Hi {{1}}, you have been added to the project *{{2}}* as {{3}}. Log in to view project details.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

-- CRM & Sales
('881549291562374', 'lead_assigned', 'UTILITY', 'en',
 'Hi {{1}}, a new lead has been assigned to you - *{{2}}* from {{3}}. Contact number: {{4}}. Please follow up at the earliest.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('1485023609687434', 'followup_reminder', 'UTILITY', 'en',
 'Hi {{1}}, you have a follow-up due today with *{{2}}* from {{3}}. Last disposition: {{4}}. Please take action.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('697843430054268', 'call_summary_notification', 'UTILITY', 'en',
 'Hi {{1}}, your call with {{2}} lasting {{3}} minutes has been analyzed. Sentiment: {{4}}. Please log in to view the full summary.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('1237277981729719', 'quotation_sent_notification', 'UTILITY', 'en',
 'Hi {{1}}, quotation {{2}} worth Rs. {{3}} has been sent to {{4}}. Please track the payment status in the portal.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

-- Finance
('2944925375846536', 'payment_received', 'UTILITY', 'en',
 'Hi {{1}}, a payment of Rs. {{2}} has been received for project {{3}} from {{4}}. Please verify in the portal.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('1608375080852870', 'expense_submitted', 'UTILITY', 'en',
 'Hi {{1}}, {{2}} has submitted a travel expense claim of Rs. {{3}} for {{4}}. Please review.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('930483506382240', 'expense_approved', 'UTILITY', 'en',
 'Hi {{1}}, your expense claim of Rs. {{2}} for {{3}} has been reviewed by {{4}}. Please check the portal for the updated status.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"},{"index":4,"placeholder":"{{4}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

-- Onboarding & Admin
('926135377006204', 'welcome_onboarding', 'UTILITY', 'en',
 'Welcome to the team, {{1}}! Your account at {{2}} has been created. Please visit the portal to complete your onboarding process.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('814328378404230', 'password_reset_notification', 'UTILITY', 'en',
 'Hi {{1}}, your password has been reset successfully. If you did not request this, please contact your admin immediately.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('973887521733898', 'document_verified', 'UTILITY', 'en',
 'Hi {{1}}, your document *{{2}}* has been verified successfully.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('1470535851092692', 'holiday_announcement', 'UTILITY', 'en',
 'Hi {{1}}, please note that {{2}} is a company holiday on {{3}}. Enjoy your day off!',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW()),

('923301227076128', 'company_announcement', 'UTILITY', 'en',
 'Hi {{1}}, new announcement from {{2}}: *{{3}}*. Log in to the portal for details.',
 '[]'::jsonb,
 '[{"index":1,"placeholder":"{{1}}"},{"index":2,"placeholder":"{{2}}"},{"index":3,"placeholder":"{{3}}"}]'::jsonb,
 '{}'::jsonb, 'pending', true, NOW());

SELECT template_name, category, status FROM whatsapp_templates ORDER BY category, template_name;
