-- Add index on demandcom.mobile_numb for faster duplicate lookups during import
CREATE INDEX IF NOT EXISTS idx_demandcom_mobile_numb ON demandcom(mobile_numb);

-- Add index on master.mobile_numb for faster duplicate lookups during import
CREATE INDEX IF NOT EXISTS idx_master_mobile_numb ON master(mobile_numb);

-- Clean up staging data for the failed import
DELETE FROM import_staging WHERE import_id = 'a6a242b1-02fa-43f8-9bf8-d94c0e76db7c';

-- Mark import as cancelled so it can be retried
UPDATE bulk_import_history 
SET status = 'cancelled',
    error_log = '[{"message": "Timeout due to missing index - fixed, please retry"}]'::jsonb
WHERE id = 'a6a242b1-02fa-43f8-9bf8-d94c0e76db7c';