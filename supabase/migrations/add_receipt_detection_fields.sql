-- Migration: Add receipt detection fields to leads table
-- Run this in Supabase SQL Editor

-- Add receipt-related columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS receipt_image_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS receipt_detected_at TIMESTAMPTZ;

-- Add index for faster receipt queries
CREATE INDEX IF NOT EXISTS idx_leads_receipt_detected ON leads(receipt_detected_at) WHERE receipt_detected_at IS NOT NULL;

-- Ensure "Payment Sent" stage exists
INSERT INTO pipeline_stages (name, display_order, color, description, is_default) 
VALUES ('Payment Sent', 3, '#22c55e', 'Customer sent proof of payment', false)
ON CONFLICT DO NOTHING;
