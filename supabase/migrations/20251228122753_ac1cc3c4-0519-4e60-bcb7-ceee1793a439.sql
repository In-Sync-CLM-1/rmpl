
-- Create user_points table to track individual point transactions
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  activity_type TEXT NOT NULL REFERENCES public.point_activity_types(activity_type),
  reference_id UUID,
  description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  month_year TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_user_points_user_id ON public.user_points(user_id);
CREATE INDEX idx_user_points_month_year ON public.user_points(month_year);
CREATE INDEX idx_user_points_earned_at ON public.user_points(earned_at);

-- Enable RLS
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- Users can view all points for leaderboard (read-only)
CREATE POLICY "Authenticated users can view all points"
ON public.user_points FOR SELECT
USING (auth.uid() IS NOT NULL);

-- System can insert points
CREATE POLICY "Authenticated users can insert points"
ON public.user_points FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create monthly_point_summaries table
CREATE TABLE public.monthly_point_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  month_year TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  star_tier TEXT DEFAULT 'none',
  rank_in_team INTEGER,
  is_winner BOOLEAN DEFAULT false,
  certificate_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Create indexes
CREATE INDEX idx_monthly_summaries_month ON public.monthly_point_summaries(month_year);
CREATE INDEX idx_monthly_summaries_team ON public.monthly_point_summaries(team_id);
CREATE INDEX idx_monthly_summaries_winner ON public.monthly_point_summaries(is_winner);

-- Enable RLS
ALTER TABLE public.monthly_point_summaries ENABLE ROW LEVEL SECURITY;

-- Everyone can view summaries for leaderboard
CREATE POLICY "Authenticated users can view summaries"
ON public.monthly_point_summaries FOR SELECT
USING (auth.uid() IS NOT NULL);

-- System can manage summaries
CREATE POLICY "Authenticated users can manage summaries"
ON public.monthly_point_summaries FOR ALL
USING (auth.uid() IS NOT NULL);

-- Add points_awarded column to existing user_announcement_views table
ALTER TABLE public.user_announcement_views ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN DEFAULT false;

-- Create user_daily_activity table to track daily usage
CREATE TABLE public.user_daily_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  has_activity BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, activity_date)
);

-- Enable RLS
ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;

-- Users can manage their own daily activity
CREATE POLICY "Users can manage daily activity"
ON public.user_daily_activity FOR ALL
USING (auth.uid() = user_id);
