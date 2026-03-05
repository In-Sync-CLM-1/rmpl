-- Delete all job seeker records and related data
-- WARNING: This is a destructive operation that will permanently delete all job seeker data

-- Delete related records first (foreign key dependencies)
DELETE FROM public.job_seeker_recommendations;
DELETE FROM public.job_seeker_pipeline;
DELETE FROM public.job_seeker_engagement_summary;
DELETE FROM public.campaign_recipients WHERE job_seeker_id IS NOT NULL;
DELETE FROM public.inbound_sms;

-- Finally, delete all job seekers
DELETE FROM public.job_seekers;