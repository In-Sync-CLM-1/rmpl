-- Add activity and session tracking columns to demandcom table
ALTER TABLE demandcom 
ADD COLUMN activity_name text,
ADD COLUMN session_1 text,
ADD COLUMN session_2 text;