-- Fix chat message sending failure by adding 'chat_message' to allowed notification types
-- Drop old constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Add updated constraint with chat_message included
ALTER TABLE notifications 
ADD CONSTRAINT notifications_notification_type_check 
CHECK (notification_type = ANY (ARRAY[
  'task_assigned'::text, 
  'due_soon'::text, 
  'overdue'::text, 
  'chat_message'::text
]));