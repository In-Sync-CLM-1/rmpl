-- Update the delete policy for webhook_connectors to allow users to delete their own webhooks
DROP POLICY IF EXISTS "Admins can delete webhook connectors" ON webhook_connectors;

CREATE POLICY "Users can delete their own webhook connectors or admins can delete any"
ON webhook_connectors
FOR DELETE
USING (
  auth.uid() = created_by 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);