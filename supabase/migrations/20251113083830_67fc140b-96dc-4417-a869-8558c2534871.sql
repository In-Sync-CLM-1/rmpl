-- Populate call_dispositions table with exact hierarchy
-- Clear existing data first
TRUNCATE TABLE call_dispositions;

-- Insert dispositions with their subdispositions in exact order
INSERT INTO call_dispositions (disposition, subdispositions, is_active) VALUES
('Connected', ARRAY['Interested', 'Follow-Up require (Tentative)', 'Call back Requested', 'Already a customer', 'Registered'], true),
('Do Not call', ARRAY['Request Removal', 'Not Interested - Permanently'], true),
('NI ( Not interested )', ARRAY['Out of station', 'Travelling', 'Busy on that day', 'No requirement', 'Not relevant'], true),
('Company Closed', ARRAY['Company has stopped his Operations.', 'Company shut down'], true),
('LTO', ARRAY['Left the organization', 'Not Working anywhere', 'freelancer'], true),
('New Contact Updated', ARRAY['New Company / Contact Added'], true),
('Fully Validate', ARRAY['All require company details updated'], true),
('Partially Validate', ARRAY['70% to 80 % company details updated'], true),
('Wrong Number', ARRAY['Number out of service', 'Wrong Person', 'Incoming services not available;', 'Invalid number'], true),
('NR ( No Response )', ARRAY['Ringing', 'Beeping voice', 'Busy', 'Switch off', 'Hung up', 'No. not reachable'], true),
('Meeting Schedule', ARRAY['Demo Schedule', 'Follow-Up Schedule'], true),
('Lead', ARRAY['MQL-Marketing Qualified Lead', 'SQL- Sales Qualified Lead'], true),
('Prospect', ARRAY['Requirement confirmed -Details pending'], true),
('Future Prospect', ARRAY['Requirement after 3 Months', 'Requirement in Next Financial Year'], true),
('LP (Language Problem)', ARRAY['language Barrier'], true),
('IVC (invalid criteria)', ARRAY['Turnover / Employee not matched', 'Different City', 'Low Designation', 'Out of Wishlist'], true),
('Duplicate', ARRAY['Records Repeated'], true);