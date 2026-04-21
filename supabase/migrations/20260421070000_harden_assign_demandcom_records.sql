-- Make assign_demandcom_records return an explicit error when neither
-- "by-IDs" nor "by-filter" mode can run, and report partial matches so a
-- stale-ID situation (user selected records that have since been deleted)
-- is visible instead of silently succeeding with 0.

CREATE OR REPLACE FUNCTION public.assign_demandcom_records(
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
AS $function$
DECLARE
  v_count INT := 0;
  v_requested INT := 0;
  v_assignee_name TEXT;
  v_ids UUID[];
  v_has_ids BOOLEAN;
  v_has_filter_range BOOLEAN;
BEGIN
  SELECT full_name INTO v_assignee_name FROM profiles WHERE id = p_assigned_to;
  IF v_assignee_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid assignee user');
  END IF;

  v_has_ids := p_record_ids IS NOT NULL
               AND COALESCE(array_length(p_record_ids, 1), 0) > 0;
  v_has_filter_range := p_offset IS NOT NULL AND p_limit IS NOT NULL;

  IF NOT v_has_ids AND NOT v_has_filter_range THEN
    RETURN jsonb_build_object(
      'error', 'No records selected. Pass record IDs or a filter range (offset/limit).',
      'successCount', 0,
      'assigneeName', v_assignee_name
    );
  END IF;

  IF v_has_ids THEN
    v_requested := array_length(p_record_ids, 1);
    UPDATE demandcom SET
      assigned_to = p_assigned_to,
      assigned_by = p_assigned_by,
      assigned_at = NOW(),
      assignment_status = 'assigned'
    WHERE id = ANY(p_record_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count = 0 THEN
      RETURN jsonb_build_object(
        'error', format(
          'None of the %s selected record(s) were found. They may have been deleted — please refresh the page and try again.',
          v_requested
        ),
        'successCount', 0,
        'requestedCount', v_requested,
        'assigneeName', v_assignee_name
      );
    END IF;

    RETURN jsonb_build_object(
      'successCount', v_count,
      'requestedCount', v_requested,
      'message', CASE
        WHEN v_count < v_requested THEN format(
          'Assigned %s of %s record(s) to %s. %s were not found (possibly deleted).',
          v_count, v_requested, v_assignee_name, v_requested - v_count
        )
        ELSE format('Successfully assigned %s record(s) to %s', v_count, v_assignee_name)
      END,
      'assigneeName', v_assignee_name
    );
  END IF;

  -- Filter+range mode
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

  IF v_ids IS NULL OR COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'error', 'No records matched the filter + offset/limit.',
      'successCount', 0,
      'assigneeName', v_assignee_name
    );
  END IF;

  UPDATE demandcom SET
    assigned_to = p_assigned_to,
    assigned_by = p_assigned_by,
    assigned_at = NOW(),
    assignment_status = 'assigned'
  WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'successCount', v_count,
    'message', format('Successfully assigned %s record(s) to %s', v_count, v_assignee_name),
    'assigneeName', v_assignee_name
  );
END;
$function$;
