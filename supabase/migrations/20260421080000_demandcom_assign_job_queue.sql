-- Queue-based bulk assign for DemandCom.
-- Motivation: a single assign_demandcom_records call over "All filtered data"
-- (~283k rows) can run past the Data API timeout, leaving the update committed
-- but the client with a retried empty-payload response and a misleading
-- "0 records" toast. This moves bulk assignment to a two-phase job so each
-- client batch is short, idempotent, and independently observable.

CREATE TABLE IF NOT EXISTS public.demandcom_assign_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to uuid NOT NULL REFERENCES public.profiles(id),
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  target_ids uuid[] NOT NULL,
  processed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demandcom_assign_jobs_created_at
  ON public.demandcom_assign_jobs (created_at DESC);

ALTER TABLE public.demandcom_assign_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read assign jobs" ON public.demandcom_assign_jobs;
CREATE POLICY "Authenticated users can read assign jobs"
  ON public.demandcom_assign_jobs FOR SELECT TO authenticated USING (true);

-- Phase 1: materialize the target ID list into a job row.
-- Accepts either an explicit id array OR a filter+offset/limit spec.
CREATE OR REPLACE FUNCTION public.start_demandcom_assign_job(
  p_assigned_to uuid,
  p_assigned_by uuid,
  p_record_ids uuid[] DEFAULT NULL::uuid[],
  p_offset integer DEFAULT NULL::integer,
  p_limit integer DEFAULT NULL::integer,
  p_name_email text DEFAULT NULL::text,
  p_city text DEFAULT NULL::text,
  p_activity_name text DEFAULT NULL::text,
  p_assigned_filter text DEFAULT NULL::text,
  p_disposition text[] DEFAULT NULL::text[],
  p_subdisposition text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_job_id uuid;
  v_assignee_name text;
  v_total int;
BEGIN
  SELECT full_name INTO v_assignee_name FROM profiles WHERE id = p_assigned_to;
  IF v_assignee_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid assignee user');
  END IF;

  IF p_record_ids IS NOT NULL AND COALESCE(array_length(p_record_ids, 1), 0) > 0 THEN
    v_ids := p_record_ids;
  ELSIF p_offset IS NOT NULL AND p_limit IS NOT NULL THEN
    WITH filtered AS (
      SELECT id FROM demandcom
      WHERE
        (p_name_email IS NULL OR
          name ILIKE '%' || p_name_email || '%' OR
          personal_email_id ILIKE '%' || p_name_email || '%' OR
          generic_email_id ILIKE '%' || p_name_email || '%' OR
          mobile_numb ILIKE '%' || p_name_email || '%')
        AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
        AND (p_activity_name IS NULL OR activity_name ILIKE '%' || p_activity_name || '%')
        AND (p_assigned_filter IS NULL OR p_assigned_filter = 'all'
          OR (p_assigned_filter = 'unassigned' AND assigned_to IS NULL)
          OR (p_assigned_filter != 'unassigned' AND p_assigned_filter != 'all'
              AND assigned_to = p_assigned_filter::UUID))
        AND (p_disposition IS NULL OR latest_disposition = ANY(p_disposition))
        AND (p_subdisposition IS NULL OR latest_subdisposition = ANY(p_subdisposition))
      ORDER BY created_at DESC, id DESC
      OFFSET p_offset LIMIT p_limit
    )
    SELECT array_agg(id) INTO v_ids FROM filtered;
  ELSE
    RETURN jsonb_build_object(
      'error', 'No records selected. Pass record IDs or a filter range.'
    );
  END IF;

  v_total := COALESCE(array_length(v_ids, 1), 0);
  IF v_total = 0 THEN
    RETURN jsonb_build_object(
      'error', 'No records matched. They may have been deleted or reassigned already.'
    );
  END IF;

  INSERT INTO demandcom_assign_jobs (assigned_to, assigned_by, target_ids, status)
  VALUES (p_assigned_to, p_assigned_by, v_ids, 'running')
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object(
    'job_id', v_job_id,
    'total', v_total,
    'assigneeName', v_assignee_name
  );
END;
$$;

-- Phase 2: process one batch of an existing job.
-- Idempotent: the row-lock on the job row prevents two callers from
-- double-processing the same batch.
CREATE OR REPLACE FUNCTION public.process_demandcom_assign_batch(
  p_job_id uuid,
  p_batch_size integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job demandcom_assign_jobs%ROWTYPE;
  v_start int;
  v_end int;
  v_batch uuid[];
  v_updated int := 0;
  v_total int;
  v_new_status text;
BEGIN
  SELECT * INTO v_job FROM demandcom_assign_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  v_total := COALESCE(array_length(v_job.target_ids, 1), 0);

  IF v_job.status IN ('completed','failed') THEN
    RETURN jsonb_build_object(
      'assigned_count', 0,
      'processed', v_job.processed_count,
      'total', v_total,
      'has_more', false,
      'status', v_job.status
    );
  END IF;

  v_start := v_job.processed_count + 1;
  v_end := LEAST(v_job.processed_count + p_batch_size, v_total);

  IF v_start > v_total THEN
    UPDATE demandcom_assign_jobs
    SET status = 'completed', updated_at = now()
    WHERE id = p_job_id;
    RETURN jsonb_build_object(
      'assigned_count', 0,
      'processed', v_total,
      'total', v_total,
      'has_more', false,
      'status', 'completed'
    );
  END IF;

  v_batch := v_job.target_ids[v_start : v_end];

  UPDATE demandcom SET
    assigned_to = v_job.assigned_to,
    assigned_by = v_job.assigned_by,
    assigned_at = NOW(),
    assignment_status = 'assigned'
  WHERE id = ANY(v_batch);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  v_new_status := CASE WHEN v_end >= v_total THEN 'completed' ELSE 'running' END;

  UPDATE demandcom_assign_jobs
  SET processed_count = v_end,
      status = v_new_status,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'assigned_count', v_updated,
    'processed', v_end,
    'total', v_total,
    'has_more', v_end < v_total,
    'status', v_new_status
  );
END;
$$;
