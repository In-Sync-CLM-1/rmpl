-- Drop the problematic SELECT policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.chat_participants;

-- Create a security definer function to check if user is participant
-- This breaks the infinite recursion by bypassing RLS
CREATE OR REPLACE FUNCTION public.is_participant_in_conversation(conv_id uuid, checking_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE conversation_id = conv_id
      AND user_id = checking_user_id
  )
$$;

-- Create a security definer function to get user's conversation IDs
CREATE OR REPLACE FUNCTION public.get_user_conversation_ids(checking_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id
  FROM public.chat_participants
  WHERE user_id = checking_user_id
$$;

-- Create new SELECT policy using the security definer function
CREATE POLICY "Users can view participants of their conversations" 
ON public.chat_participants 
FOR SELECT 
USING (
  conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);

-- Also fix chat_conversations SELECT policy to use security definer function
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.chat_conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.chat_conversations
FOR SELECT
USING (
  id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);

-- Also fix chat_messages SELECT policy to use security definer function
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages
FOR SELECT
USING (
  conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);

-- Fix chat_messages INSERT policy as well
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id 
  AND public.is_participant_in_conversation(conversation_id, auth.uid())
);

-- Also fix chat_conversations UPDATE policy
DROP POLICY IF EXISTS "Admins can update their conversations" ON public.chat_conversations;
CREATE POLICY "Admins can update their conversations"
ON public.chat_conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants 
    WHERE conversation_id = id 
    AND user_id = auth.uid() 
    AND is_admin = true
  )
);