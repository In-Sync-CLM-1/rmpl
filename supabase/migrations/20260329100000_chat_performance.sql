-- Composite index for efficient message pagination and ordering
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
ON chat_messages (conversation_id, created_at DESC);

-- Composite index for efficient participant lookups
CREATE INDEX IF NOT EXISTS idx_chat_participants_conv_user
ON chat_participants (conversation_id, user_id);

-- RPC: get conversation metadata (last message + unread count) in a single call
-- Eliminates the N+1 query pattern where each conversation triggered 2 extra queries
CREATE OR REPLACE FUNCTION get_conversation_meta(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  last_msg_content text,
  last_msg_type text,
  last_msg_sender_id uuid,
  last_msg_created_at timestamptz,
  unread_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    cp.conversation_id,
    lm.content,
    lm.message_type::text,
    lm.sender_id,
    lm.created_at,
    (
      SELECT count(*)
      FROM chat_messages cm
      WHERE cm.conversation_id = cp.conversation_id
        AND cm.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
        AND cm.sender_id != p_user_id
    )
  FROM chat_participants cp
  LEFT JOIN LATERAL (
    SELECT cm.content, cm.message_type, cm.sender_id, cm.created_at
    FROM chat_messages cm
    WHERE cm.conversation_id = cp.conversation_id
    ORDER BY cm.created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE cp.user_id = p_user_id;
$$;
