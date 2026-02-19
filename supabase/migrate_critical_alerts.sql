-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Adds columns to existing `alerts` table for cross-client critical alerts

-- Add columns for inter-cluster critical alerts
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_cluster_id UUID REFERENCES users(id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT false;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 100;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Drop the old type constraint and add a broader one that includes critical types
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check 
  CHECK (type IN ('pest', 'drought', 'frost', 'anomaly', 'pest_outbreak', 'severe_drought', 'frost_emergency', 'chemical_hazard'));

-- Drop the old severity constraint and re-add (in case it needs updating)
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_severity_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_severity_check 
  CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Allow ALL authenticated users to view critical alerts (public safety)
CREATE POLICY "Anyone can view critical alerts" ON alerts
  FOR SELECT USING (is_critical = true);

-- Allow any authenticated user to insert alerts
DROP POLICY IF EXISTS "Insert alerts" ON alerts;
CREATE POLICY "Insert alerts" ON alerts FOR INSERT WITH CHECK (true);

-- Allow source cluster to delete/update their own critical alerts
CREATE POLICY "Source can delete own critical alerts" ON alerts
  FOR DELETE USING (auth.uid() = source_cluster_id);
CREATE POLICY "Source can update own critical alerts" ON alerts
  FOR UPDATE USING (auth.uid() = source_cluster_id);

-- Enable Realtime for alerts table
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
