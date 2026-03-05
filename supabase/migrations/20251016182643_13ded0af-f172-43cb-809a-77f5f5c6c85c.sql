-- Drop existing clients table and recreate with new schema
DROP TABLE IF EXISTS clients CASCADE;

-- Create new clients table with mobile_numb as primary key
CREATE TABLE clients (
  -- Primary Key (mobile number - non-nullable, unique)
  mobile_numb text PRIMARY KEY,
  
  -- Personal Information
  name text NOT NULL,
  designation text,
  deppt text,
  job_level_updated text,
  
  -- Contact Information
  linkedin text,
  mobile2 text,
  official text,
  personal_email_id text,
  generic_email_id text,
  
  -- Industry Information
  industry_type text,
  sub_industry text,
  
  -- Company Information
  company_name text,
  address text,
  location text,
  city text,
  state text,
  zone text,
  tier text,
  pincode text,
  website text,
  
  -- Business Metrics
  turnover text,
  emp_size text,
  erp_name text,
  erp_vendor text,
  
  -- System Fields
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for faster searches
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_company_name ON clients(company_name);
CREATE INDEX idx_clients_created_by ON clients(created_by);

-- Add updated_at trigger
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'platform_admin'::app_role)
  );