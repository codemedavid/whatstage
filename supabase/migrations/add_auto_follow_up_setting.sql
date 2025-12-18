-- Migration: Add auto_follow_up_enabled column to bot_settings
-- Run this in Supabase SQL Editor

ALTER TABLE bot_settings 
ADD COLUMN IF NOT EXISTS auto_follow_up_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN bot_settings.auto_follow_up_enabled IS 'When true, the bot will automatically send follow-up messages to inactive leads';
