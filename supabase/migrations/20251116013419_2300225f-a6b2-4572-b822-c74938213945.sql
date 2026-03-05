-- Drop form-related tables and functions
DROP TABLE IF EXISTS form_submissions CASCADE;
DROP TABLE IF EXISTS custom_forms CASCADE;
DROP TABLE IF EXISTS custom_fields CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS increment_form_submission_count(uuid);
DROP FUNCTION IF EXISTS generate_form_slug();
DROP FUNCTION IF EXISTS set_form_slug();
DROP FUNCTION IF EXISTS increment_submission_count_trigger();