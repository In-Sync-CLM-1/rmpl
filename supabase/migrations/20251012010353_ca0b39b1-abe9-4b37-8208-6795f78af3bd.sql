-- Phase 1: Rename candidates table and related tables/columns to job_seekers
-- Phase 2: Clear jobs table data

-- Step 1: Rename candidates table to job_seekers
ALTER TABLE candidates RENAME TO job_seekers;

-- Step 2: Rename candidate_engagement_summary to job_seeker_engagement_summary
ALTER TABLE candidate_engagement_summary RENAME TO job_seeker_engagement_summary;
ALTER TABLE job_seeker_engagement_summary RENAME COLUMN candidate_id TO job_seeker_id;

-- Step 3: Rename candidate_pipeline to job_seeker_pipeline
ALTER TABLE candidate_pipeline RENAME TO job_seeker_pipeline;
ALTER TABLE job_seeker_pipeline RENAME COLUMN candidate_id TO job_seeker_id;

-- Step 4: Rename candidate_recommendations to job_seeker_recommendations
ALTER TABLE candidate_recommendations RENAME TO job_seeker_recommendations;
ALTER TABLE job_seeker_recommendations RENAME COLUMN candidate_id TO job_seeker_id;

-- Step 5: Update foreign key columns in other tables
ALTER TABLE campaign_recipients RENAME COLUMN candidate_id TO job_seeker_id;
ALTER TABLE inbound_sms RENAME COLUMN candidate_id TO job_seeker_id;
ALTER TABLE webhook_logs RENAME COLUMN candidate_id TO job_seeker_id;

-- Step 6: Update webhook_connectors default target_table value
ALTER TABLE webhook_connectors ALTER COLUMN target_table SET DEFAULT 'job_seekers';
UPDATE webhook_connectors SET target_table = 'job_seekers' WHERE target_table = 'candidates';

-- Phase 2: Clear all ExcelHire job records from jobs table
DELETE FROM jobs WHERE excelhire_id IS NOT NULL;

-- Clear related sync tracking data
DELETE FROM sync_logs WHERE sync_type = 'excelhire-jobs';
DELETE FROM sync_status WHERE sync_type = 'excelhire-jobs';