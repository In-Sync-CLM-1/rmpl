-- Drop and recreate chat_conversations INSERT policy with proper WITH CHECK
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;

CREATE POLICY "Users can create conversations"
ON public.chat_conversations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- IMPORTANT: Add a RETURNING policy - users need to SELECT their newly created row
-- The issue is: after INSERT, the SELECT policy checks get_user_conversation_ids()
-- But the user isn't a participant yet (participants added after conversation)!

-- We need to allow users to SELECT conversations they just created (by created_by)
-- OR conversations they participate in
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;

CREATE POLICY "Users can view their conversations"
ON public.chat_conversations
FOR SELECT
USING (
  created_by = auth.uid() 
  OR id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);

-- Also fix chat_participants INSERT policy - the current one references chat_conversations
-- which can fail if the conversation isn't visible yet
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.chat_participants;

-- Create a simpler, more permissive INSERT policy for participants
-- Users can add participants if:
-- 1. They created the conversation (creator can add anyone)
-- 2. They are adding themselves as a participant
CREATE POLICY "Users can add participants to conversations"
ON public.chat_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid() -- Can always add yourself
  OR EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id AND c.created_by = auth.uid()
  ) -- Creator can add anyone
);

-- Also add DELETE policy for participants (missing)
DROP POLICY IF EXISTS "Admins can remove participants" ON public.chat_participants;
CREATE POLICY "Admins can remove participants"
ON public.chat_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.conversation_id = chat_participants.conversation_id
    AND cp.user_id = auth.uid()
    AND cp.is_admin = true
  )
  OR user_id = auth.uid() -- Users can remove themselves
);

-- Add DELETE policy for conversations
DROP POLICY IF EXISTS "Admins can delete conversations" ON public.chat_conversations;
CREATE POLICY "Admins can delete conversations"
ON public.chat_conversations
FOR DELETE
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = id
    AND user_id = auth.uid()
    AND is_admin = true
  )
);

-- Add DELETE policy for messages
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.chat_messages;
CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
USING (sender_id = auth.uid());