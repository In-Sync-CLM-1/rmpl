-- Drop AI recommendation-related tables and policies
-- This removes all AI recommendation functionality from the database

-- Drop policies on demandcom_recommendations
DROP POLICY IF EXISTS "Admins can delete demandcom recommendations" ON demandcom_recommendations;
DROP POLICY IF EXISTS "Users can create recommendations for their demandcom" ON demandcom_recommendations;
DROP POLICY IF EXISTS "Users can update recommendations for their demandcom" ON demandcom_recommendations;
DROP POLICY IF EXISTS "Users can view recommendations for their demandcom" ON demandcom_recommendations;

-- Drop policies on demandcom_engagement_summary
DROP POLICY IF EXISTS "Authenticated users can manage demandcom engagement summaries" ON demandcom_engagement_summary;
DROP POLICY IF EXISTS "Authenticated users can view demandcom engagement summaries" ON demandcom_engagement_summary;
DROP POLICY IF EXISTS "Users can view engagement summaries for their demandcom" ON demandcom_engagement_summary;

-- Drop the tables (CASCADE will drop any dependent objects)
DROP TABLE IF EXISTS demandcom_recommendations CASCADE;
DROP TABLE IF EXISTS demandcom_engagement_summary CASCADE;