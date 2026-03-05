-- Function 1: Delete DemandCom by Activity Name
CREATE OR REPLACE FUNCTION delete_demandcom_by_activity(p_activity_name TEXT)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete related records first (using subquery for efficiency)
  DELETE FROM call_logs WHERE demandcom_id IN 
    (SELECT id FROM demandcom WHERE activity_name = p_activity_name);
  DELETE FROM demandcom_recommendations WHERE demandcom_id IN 
    (SELECT id FROM demandcom WHERE activity_name = p_activity_name);
  DELETE FROM demandcom_pipeline WHERE demandcom_id IN 
    (SELECT id FROM demandcom WHERE activity_name = p_activity_name);
  DELETE FROM demandcom_engagement_summary WHERE demandcom_id IN 
    (SELECT id FROM demandcom WHERE activity_name = p_activity_name);
  DELETE FROM campaign_recipients WHERE demandcom_id IN 
    (SELECT id FROM demandcom WHERE activity_name = p_activity_name);
  
  -- Delete main records and get count
  WITH deleted AS (
    DELETE FROM demandcom WHERE activity_name = p_activity_name RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  deleted_count := v_deleted_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Bulk Delete DemandCom by IDs
CREATE OR REPLACE FUNCTION bulk_delete_demandcom(p_record_ids UUID[])
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete related records
  DELETE FROM call_logs WHERE demandcom_id = ANY(p_record_ids);
  DELETE FROM demandcom_recommendations WHERE demandcom_id = ANY(p_record_ids);
  DELETE FROM demandcom_pipeline WHERE demandcom_id = ANY(p_record_ids);
  DELETE FROM demandcom_engagement_summary WHERE demandcom_id = ANY(p_record_ids);
  DELETE FROM campaign_recipients WHERE demandcom_id = ANY(p_record_ids);
  
  -- Delete main records
  WITH deleted AS (
    DELETE FROM demandcom WHERE id = ANY(p_record_ids) RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  deleted_count := v_deleted_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Bulk Delete Clients by IDs
CREATE OR REPLACE FUNCTION bulk_delete_clients(p_record_ids UUID[])
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  WITH deleted AS (
    DELETE FROM clients WHERE id = ANY(p_record_ids) RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  deleted_count := v_deleted_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Clean All DemandCom Data
CREATE OR REPLACE FUNCTION clean_all_demandcom()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
  v_deleted_count BIGINT;
BEGIN
  -- Delete all related records first
  DELETE FROM call_logs WHERE demandcom_id IS NOT NULL;
  DELETE FROM demandcom_recommendations;
  DELETE FROM demandcom_pipeline;
  DELETE FROM demandcom_engagement_summary;
  DELETE FROM campaign_recipients WHERE demandcom_id IS NOT NULL;
  
  -- Delete all demandcom records
  WITH deleted AS (
    DELETE FROM demandcom RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  deleted_count := v_deleted_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 5: Delete User Related Data (for admin-delete-users)
CREATE OR REPLACE FUNCTION delete_user_related_data(p_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM user_designations WHERE user_id = p_user_id;
  DELETE FROM team_members WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;