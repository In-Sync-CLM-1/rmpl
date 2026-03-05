
-- Organizations table for org-level scoping
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  external_org_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read organizations"
  ON organizations FOR SELECT TO authenticated USING (true);

-- Main tickets table
CREATE TABLE crm_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ticket_id TEXT UNIQUE NOT NULL,
  ticket_number TEXT,
  subject TEXT,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'new',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  source TEXT,
  assigned_to TEXT,
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read tickets"
  ON crm_tickets FOR SELECT TO authenticated USING (true);

-- Comments table
CREATE TABLE crm_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_comment_id TEXT UNIQUE NOT NULL,
  crm_ticket_id UUID REFERENCES crm_tickets(id) ON DELETE CASCADE NOT NULL,
  comment TEXT,
  is_internal BOOLEAN DEFAULT false,
  created_by TEXT,
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read comments"
  ON crm_ticket_comments FOR SELECT TO authenticated USING (true);

-- Escalations table
CREATE TABLE crm_ticket_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_escalation_id TEXT UNIQUE NOT NULL,
  crm_ticket_id UUID REFERENCES crm_tickets(id) ON DELETE CASCADE NOT NULL,
  remarks TEXT,
  escalated_by TEXT,
  escalated_to TEXT,
  attachments JSONB DEFAULT '[]',
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_ticket_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read escalations"
  ON crm_ticket_escalations FOR SELECT TO authenticated USING (true);

-- History table
CREATE TABLE crm_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_history_id TEXT UNIQUE NOT NULL,
  crm_ticket_id UUID REFERENCES crm_tickets(id) ON DELETE CASCADE NOT NULL,
  action TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  org_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crm_ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read history"
  ON crm_ticket_history FOR SELECT TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_crm_tickets_status ON crm_tickets(status);
CREATE INDEX idx_crm_tickets_org ON crm_tickets(org_id);
CREATE INDEX idx_crm_ticket_comments_ticket ON crm_ticket_comments(crm_ticket_id);
CREATE INDEX idx_crm_ticket_escalations_ticket ON crm_ticket_escalations(crm_ticket_id);
CREATE INDEX idx_crm_ticket_history_ticket ON crm_ticket_history(crm_ticket_id);
