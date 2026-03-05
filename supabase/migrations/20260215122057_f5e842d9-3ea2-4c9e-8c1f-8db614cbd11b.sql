CREATE OR REPLACE VIEW csbd_actuals AS
SELECT project_owner AS user_id,
    date_trunc('month',
        CASE
            WHEN event_dates IS NOT NULL AND jsonb_array_length(event_dates) > 0 THEN ((event_dates -> 0) ->> 'date')::date
            ELSE updated_at::date
        END::timestamp with time zone) AS month,
    sum(COALESCE(final_afactor, expected_afactor, 0::numeric)) / 100000.0 AS actual_amount_inr_lacs,
    count(*) AS deals_closed,
    array_agg(project_number ORDER BY (
        CASE
            WHEN event_dates IS NOT NULL AND jsonb_array_length(event_dates) > 0 THEN ((event_dates -> 0) ->> 'date')::date
            ELSE updated_at::date
        END) DESC) AS project_numbers
   FROM projects
  WHERE status IN ('closed', 'invoiced') AND (final_afactor IS NOT NULL OR expected_afactor IS NOT NULL)
  GROUP BY project_owner, (date_trunc('month',
        CASE
            WHEN event_dates IS NOT NULL AND jsonb_array_length(event_dates) > 0 THEN ((event_dates -> 0) ->> 'date')::date
            ELSE updated_at::date
        END::timestamp with time zone));