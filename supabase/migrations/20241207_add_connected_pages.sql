-- Migration: Add connected_pages table for Facebook OAuth integration
-- Run this in Supabase SQL Editor

-- 1. Create connected_pages table
CREATE TABLE IF NOT EXISTS connected_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT NOT NULL UNIQUE,              -- Facebook page ID
  page_name TEXT NOT NULL,                    -- Page display name
  page_access_token TEXT NOT NULL,            -- Long-lived page token
  user_access_token TEXT,                     -- User token (for potential refresh)
  is_active BOOLEAN DEFAULT true,             -- Currently active/subscribed
  webhook_subscribed BOOLEAN DEFAULT false,   -- Webhook subscription status
  profile_pic TEXT,                           -- Page profile picture URL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_connected_pages_page_id ON connected_pages(page_id);
CREATE INDEX IF NOT EXISTS idx_connected_pages_is_active ON connected_pages(is_active);

-- 3. Enable RLS
ALTER TABLE connected_pages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy (allow all for now - adjust based on your auth setup)
CREATE POLICY "Allow all operations on connected_pages" ON connected_pages
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS update_connected_pages_updated_at ON connected_pages;
CREATE TRIGGER update_connected_pages_updated_at
  BEFORE UPDATE ON connected_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
