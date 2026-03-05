-- Make DemandCom Dashboard available to all authenticated users
UPDATE navigation_items 
SET requires_auth_only = true 
WHERE item_key = 'demandcom_dashboard';