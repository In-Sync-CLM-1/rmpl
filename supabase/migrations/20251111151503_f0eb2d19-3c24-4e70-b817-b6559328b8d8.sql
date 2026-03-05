-- Recreate the trigger for auto-updating disposition in demandcom
DROP TRIGGER IF EXISTS trigger_update_disposition ON call_logs;

CREATE TRIGGER trigger_update_disposition
  AFTER INSERT OR UPDATE OF disposition, subdisposition
  ON call_logs
  FOR EACH ROW
  WHEN (NEW.disposition IS NOT NULL AND NEW.disposition != '')
  EXECUTE FUNCTION update_demandcom_latest_disposition();

-- Backfill latest dispositions for existing records
UPDATE demandcom d
SET 
  latest_disposition = cl.disposition,
  latest_subdisposition = cl.subdisposition,
  last_call_date = cl.disposition_set_at
FROM (
  SELECT DISTINCT ON (demandcom_id)
    demandcom_id,
    disposition,
    subdisposition,
    disposition_set_at
  FROM call_logs
  WHERE disposition IS NOT NULL AND disposition != ''
  ORDER BY demandcom_id, disposition_set_at DESC
) cl
WHERE d.id = cl.demandcom_id;