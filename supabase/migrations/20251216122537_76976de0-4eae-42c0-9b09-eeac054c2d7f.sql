-- Drop old function overloads that don't have proper date filtering
-- This ensures only the date-filtered versions are used

-- Drop the old get_demandcom_kpi_metrics without date range params
DROP FUNCTION IF EXISTS public.get_demandcom_kpi_metrics(text, uuid, timestamp with time zone);

-- Drop the old get_demandcom_disposition_breakdown without date params
DROP FUNCTION IF EXISTS public.get_demandcom_disposition_breakdown(text, uuid);

-- Drop the old get_demandcom_activity_stats without date params
DROP FUNCTION IF EXISTS public.get_demandcom_activity_stats();