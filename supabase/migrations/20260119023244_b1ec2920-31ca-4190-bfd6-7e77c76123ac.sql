-- Add project_task_id to chat_messages for sharing project tasks
ALTER TABLE public.chat_messages 
ADD COLUMN project_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL;

-- Create index for project task lookups
CREATE INDEX idx_chat_messages_project_task_id ON public.chat_messages(project_task_id);