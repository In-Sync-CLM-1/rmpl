-- Backup affected records before making changes
CREATE TABLE IF NOT EXISTS demandcom_backup_swap_20250129 AS
SELECT * FROM demandcom
WHERE 
  (turnover SIMILAR TO '%[0-9]+ to [0-9]+%' OR turnover ~ '^[0-9]+(-[0-9]+)?$')
  AND (emp_size SIMILAR TO '%Crore%' OR emp_size ~ '[0-9]+\s*-\s*[0-9]+\s*Crore');

-- Swap emp_size and turnover values where they appear to be reversed
UPDATE demandcom
SET 
  emp_size = subquery.old_turnover,
  turnover = subquery.old_emp_size,
  updated_at = now()
FROM (
  SELECT 
    id,
    emp_size as old_emp_size,
    turnover as old_turnover
  FROM demandcom
  WHERE 
    (turnover SIMILAR TO '%[0-9]+ to [0-9]+%' OR turnover ~ '^[0-9]+(-[0-9]+)?$')
    AND (emp_size SIMILAR TO '%Crore%' OR emp_size ~ '[0-9]+\s*-\s*[0-9]+\s*Crore')
) subquery
WHERE demandcom.id = subquery.id;