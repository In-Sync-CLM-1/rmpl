-- Insert teams
INSERT INTO teams (name, is_active) VALUES
('CSBD', true),
('Demandcom-Calling', true),
('CommunityCOM', true),
('Digicom', true),
('Demandcom-Database', true),
('Livecom', true),
('Human Resource', true),
('Accounts', true),
('Administrator', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;