-- Add user_id column to track who initiated the recommendation generation
ALTER TABLE public.candidate_recommendations
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can view recommendations" ON public.candidate_recommendations;
DROP POLICY IF EXISTS "Users can create recommendations" ON public.candidate_recommendations;
DROP POLICY IF EXISTS "Users can update recommendations" ON public.candidate_recommendations;

-- Create secure RLS policies that respect candidate ownership
CREATE POLICY "Users can view recommendations for their candidates"
ON public.candidate_recommendations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.candidates
    WHERE candidates.id = candidate_recommendations.candidate_id
    AND candidates.created_by = auth.uid()
  )
  OR
  has_role(auth.uid(), 'admin')
  OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Users can create recommendations for their candidates"
ON public.candidate_recommendations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidates
    WHERE candidates.id = candidate_recommendations.candidate_id
    AND candidates.created_by = auth.uid()
  )
  OR
  has_role(auth.uid(), 'admin')
  OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Users can update recommendations for their candidates"
ON public.candidate_recommendations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.candidates
    WHERE candidates.id = candidate_recommendations.candidate_id
    AND candidates.created_by = auth.uid()
  )
  OR
  has_role(auth.uid(), 'admin')
  OR
  has_role(auth.uid(), 'super_admin')
);

-- Update engagement summary policies
DROP POLICY IF EXISTS "System can manage engagement summaries" ON public.candidate_engagement_summary;

CREATE POLICY "Users can view engagement summaries for their candidates"
ON public.candidate_engagement_summary
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.candidates
    WHERE candidates.id = candidate_engagement_summary.candidate_id
    AND candidates.created_by = auth.uid()
  )
  OR
  has_role(auth.uid(), 'admin')
  OR
  has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Authenticated users can manage engagement summaries"
ON public.candidate_engagement_summary
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.candidates
    WHERE candidates.id = candidate_engagement_summary.candidate_id
    AND candidates.created_by = auth.uid()
  )
  OR
  has_role(auth.uid(), 'admin')
  OR
  has_role(auth.uid(), 'super_admin')
);