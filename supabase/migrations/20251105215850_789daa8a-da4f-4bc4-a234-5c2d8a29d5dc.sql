-- Create feature announcements table
CREATE TABLE IF NOT EXISTS public.feature_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  announcement_type TEXT NOT NULL CHECK (announcement_type IN ('new_feature', 'update', 'bug_fix', 'removal', 'improvement')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  target_roles TEXT[] DEFAULT NULL,
  image_url TEXT,
  link_url TEXT,
  link_text TEXT,
  is_active BOOLEAN DEFAULT true,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create user announcement views tracking table
CREATE TABLE IF NOT EXISTS public.user_announcement_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  announcement_id UUID NOT NULL REFERENCES public.feature_announcements(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT false,
  UNIQUE(user_id, announcement_id)
);

-- Enable RLS
ALTER TABLE public.feature_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_announcements
CREATE POLICY "Admins can manage announcements"
  ON public.feature_announcements
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

CREATE POLICY "Users can view active announcements"
  ON public.feature_announcements
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for user_announcement_views
CREATE POLICY "Users can manage their own views"
  ON public.user_announcement_views
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all announcement views"
  ON public.user_announcement_views
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'platform_admin'::app_role)
  );

-- Create indexes for performance
CREATE INDEX idx_feature_announcements_published ON public.feature_announcements(published_at DESC) WHERE is_active = true;
CREATE INDEX idx_user_announcement_views_user ON public.user_announcement_views(user_id);
CREATE INDEX idx_user_announcement_views_announcement ON public.user_announcement_views(announcement_id);

-- Create trigger for updated_at
CREATE TRIGGER update_feature_announcements_updated_at
  BEFORE UPDATE ON public.feature_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for announcements
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_announcements;

COMMENT ON TABLE public.feature_announcements IS 'Stores feature announcements and changelog entries for users';
COMMENT ON TABLE public.user_announcement_views IS 'Tracks which users have viewed which announcements';
