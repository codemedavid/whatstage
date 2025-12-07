-- Migration: Add apply_to_existing column to workflows table
-- This determines whether publishes should trigger the workflow for existing leads in the trigger stage

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS apply_to_existing BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN workflows.apply_to_existing IS 'When true, publishing this workflow will trigger it for all leads currently in the trigger stage';
