

# Support Ticket System Implementation

## Summary

Build a complete support ticket system that integrates with the go-in-sync CRM. The portal receives ticket lifecycle updates via webhooks and stores them locally for display. Admins can create tickets via the embedded help widget, and all authenticated users can view their organization's tickets.

## What Will Be Built

### Database (4 new tables + 1 organizations table)

**`organizations` table** -- needed for org-level scoping of tickets:
- `id` (UUID, PK)
- `name` (text)
- `external_org_id` (text, unique) -- maps to go-in-sync org IDs
- `created_at`

**`crm_tickets`** -- main ticket records:
- `id` (UUID, PK)
- `external_ticket_id` (text, unique) -- prevents duplicates
- `ticket_number`, `subject`, `description`, `category`, `priority`, `status`
- `contact_name`, `contact_email`, `contact_phone`
- `source`, `assigned_to`
- `due_at`, `resolved_at`
- `org_id` (UUID, FK to organizations)
- `created_at`, `updated_at`

**`crm_ticket_comments`** -- public comments:
- `external_comment_id` (text, unique)
- `crm_ticket_id` (UUID, FK)
- `comment`, `is_internal`, `created_by`
- `org_id` (UUID, FK)

**`crm_ticket_escalations`** -- escalation records:
- `external_escalation_id` (text, unique)
- `crm_ticket_id` (UUID, FK)
- `remarks`, `escalated_by`, `escalated_to`, `attachments` (JSONB)
- `org_id` (UUID, FK)

**`crm_ticket_history`** -- status/field change log:
- `external_history_id` (text, unique)
- `crm_ticket_id` (UUID, FK)
- `action`, `old_value`, `new_value`, `changed_by`
- `org_id` (UUID, FK)

All tables will have RLS enabled, allowing authenticated users to read data.

### Edge Functions (2 new)

**`crm-ticket-webhook`** -- receives webhook pushes from go-in-sync CRM
- Verifies `CRM_WEBHOOK_SECRET` bearer token
- Accepts payload: `{ tableName, operation, triggerData, orgId }`
- Maps external orgId to local organizations UUID
- Upserts into `crm_tickets`, `crm_ticket_comments`, `crm_ticket_escalations`, or `crm_ticket_history`
- Skips internal comments (`is_internal: true`)
- JWT verification disabled (uses secret token auth)

**`sync-help-ticket`** -- called by HelpWidget after ticket creation
- Validates user JWT
- Resolves org_id from user's profile
- Upserts ticket data into `crm_tickets`
- JWT verification disabled (validates in code)

### Frontend Components (4 new files)

**`src/components/Layout/HelpWidget.tsx`**
- Embeds the go-in-sync help widget (already loaded in index.html)
- Only rendered for admin/super_admin roles
- Auto-fills user name, email, company from logged-in profile
- Intercepts `window.fetch` to detect ticket creation responses
- On success, calls `sync-help-ticket` edge function for immediate local sync
- Invalidates React Query cache for instant UI refresh

**`src/pages/SupportTickets.tsx`**
- Full ticket listing page with:
  - Status filter tabs: All, New, In Progress, Awaiting, Resolved, Closed
  - Search by ticket number or subject (server-side ilike)
  - Paginated table (20 per page)
  - Latest comment displayed inline
- Detail side-sheet (click any ticket):
  - Subject, description, resolution time
  - Contact info
  - Merged chronological timeline of comments, escalations, and history

**`src/hooks/useCrmTickets.ts`**
- React Query hook for paginated ticket fetching
- Joins latest comment from `crm_ticket_comments`
- Supports status filter and search params

**`src/hooks/useCrmTicketDetail.ts`**
- React Query hook for single ticket detail
- Fetches comments, escalations, and history for timeline view

### Routing and Navigation

- New route: `/support-tickets` in App.tsx
- Sidebar entry under a "SUPPORT" section in the fallback navigation
- Uses `Headset` or `LifeBuoy` icon from lucide-react

### Secrets

- `CRM_WEBHOOK_SECRET` -- bearer token for webhook authentication (will prompt you to add)

### Config Updates

- `supabase/config.toml`: Add `verify_jwt = false` entries for both new edge functions

---

## Technical Details

### Database Migration SQL

```sql
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
```

### Edge Function: crm-ticket-webhook

- Receives POST with bearer token auth (`CRM_WEBHOOK_SECRET`)
- Routes based on `tableName`: `support_tickets` -> `crm_tickets`, `support_ticket_comments` -> `crm_ticket_comments`, etc.
- Maps `orgId` from payload to local `organizations.external_org_id`
- Uses service role client for upserts
- Skips comments with `is_internal: true`

### Edge Function: sync-help-ticket

- Authenticates user via JWT (`getClaims`)
- Resolves org from first organization in DB (single-tenant)
- Upserts ticket into `crm_tickets`
- Returns success/failure

### HelpWidget Component

- Patches `window.fetch` to intercept responses to the help widget's submit endpoint
- Extracts ticket data from the response
- Calls `sync-help-ticket` to immediately store ticket locally
- Only renders for admin roles

### File Creation Order

1. Database migration (tables + RLS + indexes)
2. Prompt for `CRM_WEBHOOK_SECRET`
3. Edge functions: `crm-ticket-webhook/index.ts`, `sync-help-ticket/index.ts`
4. Config.toml updates
5. Hooks: `useCrmTickets.ts`, `useCrmTicketDetail.ts`
6. Page: `SupportTickets.tsx`
7. Component: `HelpWidget.tsx`
8. Route in `App.tsx`
9. Sidebar entry in `AppSidebar.tsx`
10. HelpWidget integration in `AppLayout.tsx`

