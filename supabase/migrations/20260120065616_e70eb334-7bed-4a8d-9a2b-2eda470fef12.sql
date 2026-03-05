-- Add conversation_id column to notifications table for chat message notifications
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_conversation ON notifications(conversation_id);

-- Create trigger function to insert notifications for chat messages
CREATE OR REPLACE FUNCTION create_chat_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_participant RECORD;
  v_sender_name TEXT;
  v_conversation_name TEXT;
  v_preview TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO v_sender_name 
  FROM profiles WHERE id = NEW.sender_id;

  -- Get conversation name (for group) or null (for direct)
  SELECT 
    CASE 
      WHEN conversation_type = 'group' THEN name
      ELSE NULL
    END INTO v_conversation_name
  FROM chat_conversations WHERE id = NEW.conversation_id;

  -- Build preview text
  v_preview := CASE 
    WHEN NEW.message_type = 'file' THEN 'Sent a file'
    WHEN NEW.message_type = 'task_share' THEN 'Shared a task'
    WHEN NEW.message_type = 'gif' THEN 'Sent a GIF'
    ELSE LEFT(COALESCE(NEW.content, 'New message'), 100)
  END;

  -- Create notification for each participant except sender
  FOR v_participant IN 
    SELECT user_id FROM chat_participants 
    WHERE conversation_id = NEW.conversation_id 
    AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (
      user_id,
      notification_type,
      title,
      message,
      conversation_id,
      is_read
    ) VALUES (
      v_participant.user_id,
      'chat_message',
      COALESCE(v_sender_name, 'Someone') || 
        CASE WHEN v_conversation_name IS NOT NULL 
          THEN ' in ' || v_conversation_name 
          ELSE '' 
        END,
      v_preview,
      NEW.conversation_id,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists to avoid conflicts)
DROP TRIGGER IF EXISTS notify_chat_message_recipients ON chat_messages;

CREATE TRIGGER notify_chat_message_recipients
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION create_chat_message_notification();