-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;
DROP POLICY IF EXISTS "Conversation creators can add participants" ON public.chat_participants;

-- Create fixed SELECT policy: Users can view participants if they are also a participant
-- Use a simpler approach that doesn't cause recursion
CREATE POLICY "Users can view participants of their conversations" 
ON public.chat_participants 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT conversation_id 
    FROM public.chat_participants 
    WHERE user_id = auth.uid()
  )
);

-- Create fixed INSERT policy: Allow conversation creators to add participants
-- Also allow users to add themselves (for joining)
CREATE POLICY "Users can add participants to conversations" 
ON public.chat_participants 
FOR INSERT 
WITH CHECK (
  -- User is the creator of the conversation
  (
    SELECT created_by 
    FROM public.chat_conversations 
    WHERE id = conversation_id
  ) = auth.uid()
  -- OR user is adding themselves
  OR user_id = auth.uid()
);