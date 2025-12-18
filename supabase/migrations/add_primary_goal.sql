-- Migration: Add primary_goal column to bot_settings
-- Run this in Supabase SQL Editor

ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS primary_goal TEXT DEFAULT 'lead_generation' 
CHECK (primary_goal IN ('lead_generation', 'appointment_booking', 'tripping', 'purchase'));

-- Comment for clarity
COMMENT ON COLUMN bot_settings.primary_goal IS 'Primary bot objective: lead_generation, appointment_booking, tripping (real estate), or purchase (e-commerce)';
