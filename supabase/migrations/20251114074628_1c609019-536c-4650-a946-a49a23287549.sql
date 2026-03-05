-- Create function to increment form submission count
CREATE OR REPLACE FUNCTION increment_form_submission_count(form_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE custom_forms
  SET submission_count = submission_count + 1
  WHERE id = form_id;
END;
$$;

-- Create trigger to auto-increment submission count on new submissions
CREATE OR REPLACE FUNCTION increment_submission_count_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE custom_forms
  SET submission_count = submission_count + 1
  WHERE id = NEW.form_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_increment_submission_count
AFTER INSERT ON form_submissions
FOR EACH ROW
EXECUTE FUNCTION increment_submission_count_trigger();