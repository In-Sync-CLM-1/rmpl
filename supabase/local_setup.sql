-- ============================================================
-- Supabase Mock Schemas for Local PostgreSQL
-- Creates stub auth, storage schemas, roles, and functions
-- that the migrations depend on.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SUPABASE ROLES (required by RLS policies)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
    CREATE ROLE dashboard_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    -- postgres already exists as superuser
    NULL;
  END IF;
END $$;

-- Grant schema usage to roles
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============================================================
-- AUTH SCHEMA (Supabase GoTrue mock)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID,
  aud VARCHAR(255),
  role VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  encrypted_password VARCHAR(255),
  email_confirmed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  confirmation_token VARCHAR(255),
  confirmation_sent_at TIMESTAMPTZ,
  recovery_token VARCHAR(255),
  recovery_sent_at TIMESTAMPTZ,
  email_change_token_new VARCHAR(255),
  email_change VARCHAR(255),
  email_change_sent_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  phone VARCHAR(255),
  phone_confirmed_at TIMESTAMPTZ,
  phone_change VARCHAR(255),
  phone_change_token VARCHAR(255),
  phone_change_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  email_change_token_current VARCHAR(255),
  email_change_confirm_status SMALLINT DEFAULT 0,
  banned_until TIMESTAMPTZ,
  reauthentication_token VARCHAR(255),
  reauthentication_sent_at TIMESTAMPTZ,
  is_sso_user BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- auth.uid() stub - returns NULL in local context (no session)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULL::UUID;
$$;

-- auth.role() stub
CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT 'anon'::TEXT;
$$;

-- auth.email() stub
CREATE OR REPLACE FUNCTION auth.email()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULL::TEXT;
$$;

-- auth.jwt() stub
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT '{}'::JSONB;
$$;

-- ============================================================
-- STORAGE SCHEMA (Supabase Storage mock)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS storage;

GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO service_role;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner UUID REFERENCES auth.users(id),
  public BOOLEAN DEFAULT FALSE,
  avif_autodetection BOOLEAN DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id TEXT
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT,
  owner UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  path_tokens TEXT[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version TEXT,
  owner_id TEXT
);

GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO service_role;
GRANT ALL ON storage.objects TO service_role;

-- storage.foldername() stub
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;

-- storage.filename() stub
CREATE OR REPLACE FUNCTION storage.filename(name TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT split_part(name, '/', array_length(string_to_array(name, '/'), 1));
$$;

-- storage.extension() stub
CREATE OR REPLACE FUNCTION storage.extension(name TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT split_part(name, '.', array_length(string_to_array(name, '.'), 1));
$$;

-- ============================================================
-- REALTIME (mock publication)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- ============================================================
-- pg_cron / pg_net stubs (no-op schemas + functions)
-- These extensions aren't available in vanilla PG,
-- so we create stub schemas and functions.
-- ============================================================

-- pg_cron stub
CREATE SCHEMA IF NOT EXISTS cron;

CREATE TABLE IF NOT EXISTS cron.job (
  jobid BIGSERIAL PRIMARY KEY,
  schedule TEXT,
  command TEXT,
  nodename TEXT DEFAULT 'localhost',
  nodeport INT DEFAULT 5432,
  database TEXT DEFAULT current_database(),
  username TEXT DEFAULT current_user,
  active BOOLEAN DEFAULT TRUE,
  jobname TEXT
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name TEXT, schedule TEXT, command TEXT)
RETURNS BIGINT
LANGUAGE PLPGSQL
AS $$
DECLARE
  new_id BIGINT;
BEGIN
  INSERT INTO cron.job (schedule, command, jobname)
  VALUES (schedule, command, job_name)
  RETURNING jobid INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
AS $$
BEGIN
  DELETE FROM cron.job WHERE jobname = job_name;
  RETURN TRUE;
END;
$$;

-- pg_net stub
CREATE SCHEMA IF NOT EXISTS net;

CREATE OR REPLACE FUNCTION net.http_post(
  url TEXT,
  body JSONB DEFAULT '{}'::JSONB,
  params JSONB DEFAULT '{}'::JSONB,
  headers JSONB DEFAULT '{}'::JSONB,
  timeout_milliseconds INT DEFAULT 5000
)
RETURNS BIGINT
LANGUAGE SQL
AS $$
  SELECT 0::BIGINT;
$$;

CREATE OR REPLACE FUNCTION net.http_get(
  url TEXT,
  params JSONB DEFAULT '{}'::JSONB,
  headers JSONB DEFAULT '{}'::JSONB,
  timeout_milliseconds INT DEFAULT 5000
)
RETURNS BIGINT
LANGUAGE SQL
AS $$
  SELECT 0::BIGINT;
$$;

-- ============================================================
-- EXTENSIONS SCHEMA (some migrations reference it)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO service_role;
