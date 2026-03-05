-- Create chat_message_reactions table
CREATE TABLE public.chat_message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX idx_chat_reactions_message_id ON public.chat_message_reactions(message_id);
CREATE INDEX idx_chat_reactions_user_id ON public.chat_message_reactions(user_id);

-- Enable RLS
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on messages in their conversations
CREATE POLICY "Users can view reactions in their conversations"
ON public.chat_message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.chat_participants cp ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = chat_message_reactions.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Users can add reactions to messages in their conversations
CREATE POLICY "Users can add reactions"
ON public.chat_message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.chat_participants cp ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = message_id
    AND cp.user_id = auth.uid()
  )
);

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own reactions"
ON public.chat_message_reactions FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;