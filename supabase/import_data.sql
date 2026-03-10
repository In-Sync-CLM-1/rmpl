-- ============================================================
-- Import RMPL data from CSV files
-- ============================================================

-- Disable FK checks and triggers during import
SET session_replication_role = 'replica';

-- ============================================================
-- 1. Import auth.users (column mapping needed)
-- ============================================================
CREATE TEMP TABLE auth_users_staging (
  id UUID,
  email TEXT,
  phone TEXT,
  email_confirmed_at TIMESTAMPTZ,
  phone_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  role TEXT,
  user_metadata JSONB,
  app_metadata JSONB
);

\copy auth_users_staging FROM 'C:/Users/admin/Downloads/RMPL-data/auth_users_20260305_193515.csv' WITH (FORMAT csv, HEADER true, NULL '');

INSERT INTO auth.users (id, email, phone, email_confirmed_at, phone_confirmed_at, created_at, updated_at, last_sign_in_at, role, raw_user_meta_data, raw_app_meta_data)
SELECT id, email, NULLIF(phone, ''), email_confirmed_at, phone_confirmed_at, created_at, updated_at, last_sign_in_at, role, COALESCE(user_metadata, '{}'::jsonb), COALESCE(app_metadata, '{}'::jsonb)
FROM auth_users_staging
ON CONFLICT (id) DO NOTHING;

DROP TABLE auth_users_staging;

-- ============================================================
-- 2. Import all public tables (alphabetical, non-empty files)
-- ============================================================

\copy public.profiles FROM 'C:/Users/admin/Downloads/RMPL-data/profiles_20260305_193740.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_roles FROM 'C:/Users/admin/Downloads/RMPL-data/user_roles_20260305_193808.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.teams FROM 'C:/Users/admin/Downloads/RMPL-data/teams_20260305_193806.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.designations FROM 'C:/Users/admin/Downloads/RMPL-data/designations_20260305_193635.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.pipeline_stages FROM 'C:/Users/admin/Downloads/RMPL-data/pipeline_stages_20260305_193739.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.email_templates FROM 'C:/Users/admin/Downloads/RMPL-data/email_templates_20260305_193639.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.point_activity_types FROM 'C:/Users/admin/Downloads/RMPL-data/point_activity_types_20260305_195429.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.role_metadata FROM 'C:/Users/admin/Downloads/RMPL-data/role_metadata_20260305_195521.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.onboarding_forms FROM 'C:/Users/admin/Downloads/RMPL-data/onboarding_forms_20260305_195351.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.onboarding_steps FROM 'C:/Users/admin/Downloads/RMPL-data/onboarding_steps_20260305_195354.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.onboarding_tours FROM 'C:/Users/admin/Downloads/RMPL-data/onboarding_tours_20260305_195404.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.company_holidays FROM 'C:/Users/admin/Downloads/RMPL-data/company_holidays_20260305_193558.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.navigation_sections FROM 'C:/Users/admin/Downloads/RMPL-data/navigation_sections_20260305_195332.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.navigation_items FROM 'C:/Users/admin/Downloads/RMPL-data/navigation_items_20260305_195328.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.webhook_connectors FROM 'C:/Users/admin/Downloads/RMPL-data/webhook_connectors_20260305_195654.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.call_dispositions FROM 'C:/Users/admin/Downloads/RMPL-data/call_dispositions_20260305_193539.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Core business tables
\copy public.demandcom FROM 'C:/Users/admin/Downloads/RMPL-data/demandcom_20260305_193620.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.clients FROM 'C:/Users/admin/Downloads/RMPL-data/clients_20260305_193556.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.master FROM 'C:/Users/admin/Downloads/RMPL-data/master_20260305_193717.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.vendors FROM 'C:/Users/admin/Downloads/RMPL-data/vendors_20260305_193817.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.projects FROM 'C:/Users/admin/Downloads/RMPL-data/projects_20260305_193756.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- Dependent tables
\copy public.attendance_records FROM 'C:/Users/admin/Downloads/RMPL-data/attendance_records_20260305_193520.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.attendance_regularizations FROM 'C:/Users/admin/Downloads/RMPL-data/attendance_regularizations_20260305_193523.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.backup_history FROM 'C:/Users/admin/Downloads/RMPL-data/backup_history_20260305_193525.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.bulk_import_history FROM 'C:/Users/admin/Downloads/RMPL-data/bulk_import_history_20260305_193528.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.bulk_import_records FROM 'C:/Users/admin/Downloads/RMPL-data/bulk_import_records_20260305_193531.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.call_logs FROM 'C:/Users/admin/Downloads/RMPL-data/call_logs_20260305_193542.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.campaign_recipients FROM 'C:/Users/admin/Downloads/RMPL-data/campaign_recipients_20260305_193545.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.campaigns FROM 'C:/Users/admin/Downloads/RMPL-data/campaigns_20260305_193547.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.chat_conversations FROM 'C:/Users/admin/Downloads/RMPL-data/chat_conversations_20260305_193549.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.chat_message_reactions FROM 'C:/Users/admin/Downloads/RMPL-data/chat_message_reactions_20260305_193550.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.chat_messages FROM 'C:/Users/admin/Downloads/RMPL-data/chat_messages_20260305_193552.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.chat_participants FROM 'C:/Users/admin/Downloads/RMPL-data/chat_participants_20260305_193554.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.csbd_credit_allocations FROM 'C:/Users/admin/Downloads/RMPL-data/csbd_credit_allocations_20260305_193612.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.csbd_projection_audit FROM 'C:/Users/admin/Downloads/RMPL-data/csbd_projection_audit_20260305_193614.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.csbd_projections FROM 'C:/Users/admin/Downloads/RMPL-data/csbd_projections_20260305_193615.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.csbd_targets FROM 'C:/Users/admin/Downloads/RMPL-data/csbd_targets_20260305_193616.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.demandcom_backup_swap_20250129 FROM 'C:/Users/admin/Downloads/RMPL-data/demandcom_backup_swap_20250129_20260305_195019.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.demandcom_daily_performance FROM 'C:/Users/admin/Downloads/RMPL-data/demandcom_daily_performance_20260305_193622.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.demandcom_daily_targets FROM 'C:/Users/admin/Downloads/RMPL-data/demandcom_daily_targets_20260305_193624.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.demandcom_field_changes FROM 'C:/Users/admin/Downloads/RMPL-data/demandcom_field_changes_20260305_193627.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.employee_documents FROM 'C:/Users/admin/Downloads/RMPL-data/employee_documents_20260305_195026.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.employee_personal_details FROM 'C:/Users/admin/Downloads/RMPL-data/employee_personal_details_20260305_193640.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.events FROM 'C:/Users/admin/Downloads/RMPL-data/events_20260305_193642.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.feature_announcements FROM 'C:/Users/admin/Downloads/RMPL-data/feature_announcements_20260305_193645.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.general_tasks FROM 'C:/Users/admin/Downloads/RMPL-data/general_tasks_20260305_193655.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.hr_policy_documents FROM 'C:/Users/admin/Downloads/RMPL-data/hr_policy_documents_20260305_195226.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.import_batches FROM 'C:/Users/admin/Downloads/RMPL-data/import_batches_20260305_193700.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.import_staging FROM 'C:/Users/admin/Downloads/RMPL-data/import_staging_20260305_195236.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.inventory_items FROM 'C:/Users/admin/Downloads/RMPL-data/inventory_items_20260305_193707.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.late_coming_records FROM 'C:/Users/admin/Downloads/RMPL-data/late_coming_records_20260305_195255.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.leave_applications FROM 'C:/Users/admin/Downloads/RMPL-data/leave_applications_20260305_195259.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.leave_balance_adjustments FROM 'C:/Users/admin/Downloads/RMPL-data/leave_balance_adjustments_20260305_195304.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.leave_balances FROM 'C:/Users/admin/Downloads/RMPL-data/leave_balances_20260305_195310.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.monthly_point_summaries FROM 'C:/Users/admin/Downloads/RMPL-data/monthly_point_summaries_20260305_195324.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.notifications FROM 'C:/Users/admin/Downloads/RMPL-data/notifications_20260305_193721.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.onboarding_otp_verifications FROM 'C:/Users/admin/Downloads/RMPL-data/onboarding_otp_verifications_20260305_193725.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.onboarding_submissions FROM 'C:/Users/admin/Downloads/RMPL-data/onboarding_submissions_20260305_193727.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.operations_inventory_distribution FROM 'C:/Users/admin/Downloads/RMPL-data/operations_inventory_distribution_20260305_195408.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.password_reset_logs FROM 'C:/Users/admin/Downloads/RMPL-data/password_reset_logs_20260305_195420.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_demandcom_allocations FROM 'C:/Users/admin/Downloads/RMPL-data/project_demandcom_allocations_20260305_195433.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_demandcom_checklist FROM 'C:/Users/admin/Downloads/RMPL-data/project_demandcom_checklist_20260305_195439.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_digicom_checklist FROM 'C:/Users/admin/Downloads/RMPL-data/project_digicom_checklist_20260305_195443.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_files FROM 'C:/Users/admin/Downloads/RMPL-data/project_files_20260305_193745.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_livecom_checklist FROM 'C:/Users/admin/Downloads/RMPL-data/project_livecom_checklist_20260305_195447.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_livecom_events FROM 'C:/Users/admin/Downloads/RMPL-data/project_livecom_events_20260305_193750.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_quotations FROM 'C:/Users/admin/Downloads/RMPL-data/project_quotations_20260305_193752.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_tasks FROM 'C:/Users/admin/Downloads/RMPL-data/project_tasks_20260305_193753.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.project_team_members FROM 'C:/Users/admin/Downloads/RMPL-data/project_team_members_20260305_195457.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.quotation_payments FROM 'C:/Users/admin/Downloads/RMPL-data/quotation_payments_20260305_193759.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.sync_batches FROM 'C:/Users/admin/Downloads/RMPL-data/sync_batches_20260305_195524.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.sync_logs FROM 'C:/Users/admin/Downloads/RMPL-data/sync_logs_20260305_195527.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.sync_status FROM 'C:/Users/admin/Downloads/RMPL-data/sync_status_20260305_195537.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.team_members FROM 'C:/Users/admin/Downloads/RMPL-data/team_members_20260305_195542.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_announcement_views FROM 'C:/Users/admin/Downloads/RMPL-data/user_announcement_views_20260305_195604.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_designations FROM 'C:/Users/admin/Downloads/RMPL-data/user_designations_20260305_195626.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_onboarding_progress FROM 'C:/Users/admin/Downloads/RMPL-data/user_onboarding_progress_20260305_195635.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_optional_holiday_claims FROM 'C:/Users/admin/Downloads/RMPL-data/user_optional_holiday_claims_20260305_195637.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_points FROM 'C:/Users/admin/Downloads/RMPL-data/user_points_20260305_195643.csv' WITH (FORMAT csv, HEADER true, NULL '');
\copy public.user_view_permissions FROM 'C:/Users/admin/Downloads/RMPL-data/user_view_permissions_20260305_195648.csv' WITH (FORMAT csv, HEADER true, NULL '');

-- ============================================================
-- 3. Re-enable FK checks and triggers
-- ============================================================
SET session_replication_role = 'origin';
