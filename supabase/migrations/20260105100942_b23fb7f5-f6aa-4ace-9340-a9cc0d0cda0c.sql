-- Delete the demandcom records uploaded by Mukesh on 30th Dec 2025
DELETE FROM demandcom 
WHERE created_by = 'fa3ea3ec-f80e-49cc-9cd7-ef5e78d7581b'
AND created_at >= '2025-12-30 00:00:00'
AND created_at < '2025-12-31 00:00:00';