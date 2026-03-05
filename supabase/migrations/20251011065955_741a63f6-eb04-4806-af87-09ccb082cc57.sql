-- Add unique constraint on email for duplicate prevention
ALTER TABLE candidates 
ADD CONSTRAINT candidates_email_unique UNIQUE (email);

-- Add index for faster lookups during upsert
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

-- Add index for ExcelHire sync tracking
CREATE INDEX IF NOT EXISTS idx_candidates_excelhire_id ON candidates(excelhire_id);