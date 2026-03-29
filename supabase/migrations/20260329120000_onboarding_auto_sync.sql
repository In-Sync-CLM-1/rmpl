-- Phase 1: Auto-sync onboarding submission data to employee tables on approval

-- Add user_id column to link a submission to an employee profile
ALTER TABLE onboarding_submissions
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_onboarding_sub_user_id ON onboarding_submissions (user_id);

-- RPC: approve an onboarding submission and sync data to employee tables
CREATE OR REPLACE FUNCTION approve_onboarding_and_sync(
  p_submission_id uuid,
  p_user_id uuid,       -- the employee's profile ID
  p_reviewer_id uuid     -- the HR admin approving
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Fetch the submission
  SELECT * INTO v_sub FROM onboarding_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- 1. Update submission status and link to user
  UPDATE onboarding_submissions SET
    status = 'approved',
    user_id = p_user_id,
    reviewed_by = p_reviewer_id,
    reviewed_at = now()
  WHERE id = p_submission_id;

  -- 2. Update profiles with name and phone (only if currently empty)
  UPDATE profiles SET
    full_name = COALESCE(NULLIF(full_name, ''), v_sub.full_name),
    phone = COALESCE(NULLIF(phone, ''), v_sub.contact_number)
  WHERE id = p_user_id;

  -- 3. Upsert employee_personal_details
  INSERT INTO employee_personal_details (
    user_id, date_of_birth, marital_status, aadhar_number,
    father_name, mother_name, emergency_contact_number,
    personal_email, present_address, permanent_address,
    blood_group
  ) VALUES (
    p_user_id, v_sub.date_of_birth, v_sub.marital_status, v_sub.aadhar_number,
    v_sub.father_name, v_sub.mother_name, v_sub.emergency_contact_number,
    v_sub.personal_email, v_sub.present_address, v_sub.permanent_address,
    v_sub.blood_group
  )
  ON CONFLICT (user_id) DO UPDATE SET
    date_of_birth = COALESCE(EXCLUDED.date_of_birth, employee_personal_details.date_of_birth),
    marital_status = COALESCE(EXCLUDED.marital_status, employee_personal_details.marital_status),
    aadhar_number = COALESCE(EXCLUDED.aadhar_number, employee_personal_details.aadhar_number),
    father_name = COALESCE(EXCLUDED.father_name, employee_personal_details.father_name),
    mother_name = COALESCE(EXCLUDED.mother_name, employee_personal_details.mother_name),
    emergency_contact_number = COALESCE(EXCLUDED.emergency_contact_number, employee_personal_details.emergency_contact_number),
    personal_email = COALESCE(EXCLUDED.personal_email, employee_personal_details.personal_email),
    present_address = COALESCE(EXCLUDED.present_address, employee_personal_details.present_address),
    permanent_address = COALESCE(EXCLUDED.permanent_address, employee_personal_details.permanent_address),
    blood_group = COALESCE(EXCLUDED.blood_group, employee_personal_details.blood_group),
    updated_at = now();

  -- 4. Upsert employee_salary_details (bank info, PAN, UAN)
  INSERT INTO employee_salary_details (user_id, pan_number, uan_number, bank_name, bank_account_number, ifsc_code)
  VALUES (p_user_id, v_sub.pan_number, v_sub.uan_number, v_sub.bank_name, v_sub.account_number, v_sub.ifsc_code)
  ON CONFLICT (user_id) DO UPDATE SET
    pan_number = COALESCE(EXCLUDED.pan_number, employee_salary_details.pan_number),
    uan_number = COALESCE(EXCLUDED.uan_number, employee_salary_details.uan_number),
    bank_name = COALESCE(EXCLUDED.bank_name, employee_salary_details.bank_name),
    bank_account_number = COALESCE(EXCLUDED.bank_account_number, employee_salary_details.bank_account_number),
    ifsc_code = COALESCE(EXCLUDED.ifsc_code, employee_salary_details.ifsc_code),
    updated_at = now();
END;
$$;
