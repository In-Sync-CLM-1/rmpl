import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'db.ltlvhmwrrsromwuiybwu.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: '7vN$F9#2xP&z@qL1', ssl: { rejectUnauthorized: false }
});

const NARESH   = 'dac44998-6bd4-4ad2-87cf-7f744d906b2a';
const GAURAV   = '8c04e189-b4b0-4505-ad3f-feda4a663e21';
const INDU     = 'ae3869ea-b6fc-41e7-8596-f0a90772cc99';
const MANOJ    = '2e6ab15f-b756-4aa9-9cff-c7ad22963e76';
const BRIJESH  = '2c0171c8-3e12-4b86-aee5-14de172efcf8';
const JATINDER = '035fcec6-b5df-4fe3-bf07-e8a220c07005';
const HR_SEC   = '996c3c38-aaa6-4d12-a2dc-e1a9bdfc4119';
const HRADM    = 'e3c0ef9f-4011-4360-9e9e-74cf32eb64e2';

await client.connect();

// 1. kpi_role_definitions
await client.query(`
  CREATE TABLE IF NOT EXISTS kpi_role_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    category_name TEXT NOT NULL,
    sub_items JSONB NOT NULL DEFAULT '[]',
    weightage INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);
await client.query(`ALTER TABLE kpi_role_definitions ENABLE ROW LEVEL SECURITY`);
await client.query(`
  DO $$ BEGIN
    CREATE POLICY "kpi_role_def_read" ON kpi_role_definitions FOR SELECT TO authenticated USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`);
console.log('kpi_role_definitions ready');

// 2. kpi_role_assessments
await client.query(`
  CREATE TABLE IF NOT EXISTS kpi_role_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    quarter TEXT NOT NULL CHECK (quarter IN ('Q1','Q2','Q3','Q4')),
    calendar_year INTEGER NOT NULL,
    self_scores JSONB NOT NULL DEFAULT '{}',
    self_total DECIMAL(6,2) NOT NULL DEFAULT 0,
    self_status TEXT NOT NULL DEFAULT 'draft' CHECK (self_status IN ('draft','submitted')),
    self_submitted_at TIMESTAMPTZ,
    manager_scores JSONB NOT NULL DEFAULT '{}',
    manager_total DECIMAL(6,2) NOT NULL DEFAULT 0,
    manager_status TEXT NOT NULL DEFAULT 'not_started' CHECK (manager_status IN ('not_started','draft','submitted')),
    manager_submitted_at TIMESTAMPTZ,
    combined_total DECIMAL(6,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, calendar_year, quarter)
  )
`);
await client.query(`ALTER TABLE kpi_role_assessments ENABLE ROW LEVEL SECURITY`);
await client.query(`
  DO $$ BEGIN
    CREATE POLICY "kpi_role_own_all" ON kpi_role_assessments FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`);
await client.query(`
  DO $$ BEGIN
    CREATE POLICY "kpi_role_manager_all" ON kpi_role_assessments FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email = 's.ray@redefine.in')
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','super_admin','admin_administration'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email = 's.ray@redefine.in')
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','super_admin','admin_administration'))
      );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`);
console.log('kpi_role_assessments ready');

// 3. Add manager columns to kpi_self_assessments
await client.query(`ALTER TABLE kpi_self_assessments ADD COLUMN IF NOT EXISTS manager_scores JSONB NOT NULL DEFAULT '{}'`);
await client.query(`ALTER TABLE kpi_self_assessments ADD COLUMN IF NOT EXISTS manager_status TEXT NOT NULL DEFAULT 'not_started'`);
await client.query(`ALTER TABLE kpi_self_assessments ADD COLUMN IF NOT EXISTS manager_submitted_at TIMESTAMPTZ`);
await client.query(`
  DO $$ BEGIN
    CREATE POLICY "kpi_self_manager_all" ON kpi_self_assessments FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email = 's.ray@redefine.in')
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','super_admin','admin_administration'))
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email = 's.ray@redefine.in')
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','super_admin','admin_administration'))
      );
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`);
console.log('kpi_self_assessments manager columns added');

// 4. Seed role definitions
await client.query(`DELETE FROM kpi_role_definitions WHERE user_id = ANY($1)`,
  [[NARESH, GAURAV, INDU, MANOJ, BRIJESH, JATINDER]]);

const defs = [
  // NARESH
  [NARESH, 'Client Satisfaction', '[]', 15, 1],
  [NARESH, 'Client Collaboration', '[]', 10, 2],
  [NARESH, 'New Pitch Wins', '[]', 15, 3],
  [NARESH, 'Capacity Utilization', '[]', 10, 4],
  [NARESH, 'Creativity & Innovation', '["Originality of ideas","Uniqueness of design concepts"]', 20, 5],
  [NARESH, 'Project Management', '["Timeliness of Project Deliveries","Adherence to budget"]', 10, 6],
  [NARESH, 'Engagement in Social Media', '["Redefine","SMBConnect","CXNet","Adviata","DtoC","Others"]', 15, 7],
  [NARESH, 'Website Updates', '[]', 5, 8],
  // GAURAV
  [GAURAV, 'Event Execution', '["Successful delivery of events on time","Adherence to event budgets","Quality of logistics and coordination"]', 25, 1],
  [GAURAV, 'Team Leadership', '["Ability to motivate and lead teams","Conflict resolution skills","Effective delegation of responsibilities"]', 10, 2],
  [GAURAV, 'Client Management', '["Client satisfaction ratings","Strength of client relationships","Responsiveness to client inquiries"]', 15, 3],
  [GAURAV, 'Strategic Planning', '["Development of event concepts","Innovation in event offerings","Ability to anticipate client needs"]', 10, 4],
  [GAURAV, 'Vendor Management', '["Vendor development and documentation","Vendor Relationship Quality"]', 10, 5],
  [GAURAV, 'Budget & Financial Planning', '["Budget Planning & Accuracy","Cost Management","Vendor Negotiation","Profitability Awareness"]', 10, 6],
  [GAURAV, 'Overall Contribution', '["Initiative in process improvements","Contribution to agency goals"]', 10, 7],
  [GAURAV, 'Documentation in OPM', '[]', 10, 8],
  // INDU
  [INDU, 'Talent Acquisition', '["Recruitment Turnaround","Quality of Recruitment","Interview Process Management"]', 40, 1],
  [INDU, 'Employee Experience', '["Onboarding process","Employee engagement","Internal Communication"]', 10, 2],
  [INDU, 'Learning & Development', '["Training Program","Performance review","Feedback"]', 10, 3],
  [INDU, 'Compliance & HR Operations', '["HR Documentation & Records","Policy Implementation","Grievance & Disciplinary Management"]', 10, 4],
  [INDU, 'Strategic HR Planning', '[]', 10, 5],
  [INDU, 'Employer Branding', '[]', 20, 6],
  // MANOJ
  [MANOJ, 'GST', '[]', 20, 1],
  [MANOJ, 'PF', '[]', 5, 2],
  [MANOJ, 'ESI', '[]', 5, 3],
  [MANOJ, 'Invoicing', '[]', 15, 4],
  [MANOJ, 'MSA Claim Status', '[]', 15, 5],
  [MANOJ, 'Collection', '[]', 10, 6],
  [MANOJ, 'Ageing Report', '[]', 5, 7],
  [MANOJ, 'Payout', '[]', 5, 8],
  [MANOJ, 'Vendor', '[]', 5, 9],
  [MANOJ, 'Expenses', '[]', 5, 10],
  [MANOJ, 'Team Development', '[]', 10, 11],
  // BRIJESH
  [BRIJESH, 'Supplier Management', '["Quality of vendor selection","Timeliness of supplier deliveries","Relationship management with suppliers"]', 20, 1],
  [BRIJESH, 'Cost Management', '["Ability to negotiate favorable contract terms","Adherence to budget for procurement","Cost savings achieved through procurement"]', 25, 2],
  [BRIJESH, 'Logistics Coordination', '["Efficiency in transportation and shipping","Accuracy of equipment and materials inventory","Problem-solving in logistical challenges"]', 15, 3],
  [BRIJESH, 'Operational Efficiency', '["Streamlining procurement process","Implementation of best practices in logistics"]', 15, 4],
  [BRIJESH, 'Cross-Functional Collaboration', '["Collaboration with event planning teams","Responsiveness to team needs and requests"]', 10, 5],
  [BRIJESH, 'Compliance & Risk Management', '["Adherence to legal and regulatory requirements","Risk assessment and mitigation strategies"]', 5, 6],
  [BRIJESH, 'Overall Contribution', '["Initiative in process improvements"]', 10, 7],
  // JATINDER
  [JATINDER, 'Leadership & Team Management', '[]', 5, 1],
  [JATINDER, 'Call Quality & Effectiveness', '[]', 7, 2],
  [JATINDER, 'Training & Development', '[]', 2, 3],
  [JATINDER, 'Target Achievement', '[]', 50, 4],
  [JATINDER, 'Data Management', '["Ensure data availability for campaign","Post event data consolidation"]', 20, 5],
  [JATINDER, 'Campaign Management', '["Resource planning","Planning in case of challenges in campaign"]', 5, 6],
  [JATINDER, 'Client Relationship Management', '[]', 2, 7],
  [JATINDER, 'Feedback Utilization', '[]', 2, 8],
  [JATINDER, 'Reporting & Analytics', '["Usage of OPM by team"]', 2, 9],
  [JATINDER, 'Problem Solving', '[]', 5, 10],
];

for (const [uid, cat, subs, wt, ord] of defs) {
  await client.query(
    `INSERT INTO kpi_role_definitions (user_id, category_name, sub_items, weightage, sort_order) VALUES ($1,$2,$3::jsonb,$4,$5)`,
    [uid, cat, subs, wt, ord]
  );
}
console.log(`Seeded ${defs.length} role KPI definitions`);

// 5. Navigation items
await client.query(`DELETE FROM navigation_items WHERE item_key IN ('kpi-role-assessment','kpi-role-team-dashboard')`);
await client.query(`
  INSERT INTO navigation_items (section_id, item_key, item_title, item_url, icon_name, display_order, is_active, requires_auth_only, legacy_permission)
  VALUES
    ($1, 'kpi-role-assessment', 'Performance Assessment', '/kpi-role-assessment', 'ClipboardCheck', 100, true, true, null),
    ($2, 'kpi-role-team-dashboard', 'Performance Dashboard', '/kpi-role-team-dashboard', 'BarChart3', 100, true, true, null)
`, [HR_SEC, HRADM]);
console.log('Navigation items added');

await client.end();
console.log('All done.');
