
CREATE OR REPLACE FUNCTION public.auto_grant_vapi_scheduler()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.navigation_item_id = (
    SELECT id FROM navigation_items WHERE item_key = 'demandcom_list' LIMIT 1
  ) AND NEW.can_view = true THEN
    INSERT INTO user_view_permissions (user_id, navigation_item_id, can_view)
    VALUES (
      NEW.user_id,
      (SELECT id FROM navigation_items WHERE item_key = 'vapi_scheduler' LIMIT 1),
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auto_grant_vapi_scheduler
AFTER INSERT ON user_view_permissions
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_vapi_scheduler();
