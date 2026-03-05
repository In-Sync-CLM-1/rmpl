-- Add new roles to app_role enum (must be committed before use)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin_administration';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin_tech';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'agent';