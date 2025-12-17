-- Migration: Add Smart Passive mode fields to leads table
-- Run this in Supabase SQL Editor to enable Smart Passive mode tracking

-- Add needs_human_attention flag
-- This is set to true when the AI detects the customer needs human assistance
ALTER TABLE leads ADD COLUMN IF NOT EXISTS needs_human_attention BOOLEAN DEFAULT false;

-- Add timestamp for when Smart Passive mode was activated
ALTER TABLE leads ADD COLUMN IF NOT EXISTS smart_passive_activated_at TIMESTAMPTZ;

-- Track how many questions in a row went unanswered/repeated
ALTER TABLE leads ADD COLUMN IF NOT EXISTS unanswered_question_count INT DEFAULT 0;

-- Store the last few questions to detect repetition
ALTER TABLE leads ADD COLUMN IF NOT EXISTS recent_questions JSONB DEFAULT '[]'::jsonb;

-- Store the reason why Smart Passive was activated (for agent visibility)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS smart_passive_reason TEXT;

-- Index for quickly finding leads needing human attention (for dashboard highlighting)
CREATE INDEX IF NOT EXISTS idx_leads_needs_human_attention ON leads(needs_human_attention) 
  WHERE needs_human_attention = true;

-- Comment for documentation
COMMENT ON COLUMN leads.needs_human_attention IS 'True when AI has detected customer needs human agent assistance';
COMMENT ON COLUMN leads.smart_passive_activated_at IS 'Timestamp when Smart Passive mode was activated';
COMMENT ON COLUMN leads.unanswered_question_count IS 'Count of consecutive questions the AI could not answer satisfactorily';
COMMENT ON COLUMN leads.recent_questions IS 'JSON array of recent questions for repetition detection';
COMMENT ON COLUMN leads.smart_passive_reason IS 'Reason why Smart Passive was triggered (for agent visibility)';
