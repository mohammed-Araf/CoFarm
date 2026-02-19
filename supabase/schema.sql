-- =============================================
-- C0Farm Database Schema
-- =============================================

-- Users table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  display_name TEXT
);

-- Nodes table (sensor sticks)
CREATE TABLE IF NOT EXISTS nodes (
  node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  elevation_m DOUBLE PRECISION,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'infected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sensor data readings
CREATE TABLE IF NOT EXISTS sensor_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  soil_moisture_m3m3 DOUBLE PRECISION,
  soil_temperature_c DOUBLE PRECISION,
  soil_ec_msm DOUBLE PRECISION,
  soil_ph DOUBLE PRECISION,
  soil_water_tension_kpa DOUBLE PRECISION,
  air_temperature_c DOUBLE PRECISION,
  relative_humidity_pct DOUBLE PRECISION,
  atmospheric_pressure_hpa DOUBLE PRECISION,
  ambient_co2_umolmol DOUBLE PRECISION,
  rainfall_rate_mmh DOUBLE PRECISION,
  tvoc_ugm3 DOUBLE PRECISION,
  water_table_depth_m DOUBLE PRECISION,
  solar_irradiance_wm2 DOUBLE PRECISION,
  dew_point_c DOUBLE PRECISION,
  vpd_kpa DOUBLE PRECISION,
  frost_risk_flag TEXT,
  node_id UUID REFERENCES nodes(node_id) ON DELETE CASCADE
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  node_id UUID REFERENCES nodes(node_id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('pest', 'drought', 'frost', 'anomaly')),
  message TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can manage their own nodes
CREATE POLICY "Users can view own nodes" ON nodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nodes" ON nodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view all nodes on map" ON nodes FOR SELECT USING (true);

-- Sensor data: users can view their own node data
CREATE POLICY "Users can view own sensor data" ON sensor_data
  FOR SELECT USING (
    node_id IN (SELECT node_id FROM nodes WHERE user_id = auth.uid())
  );
CREATE POLICY "Insert sensor data" ON sensor_data FOR INSERT WITH CHECK (true);

-- Alerts: viewable by node owner
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (
    node_id IN (SELECT node_id FROM nodes WHERE user_id = auth.uid())
  );
CREATE POLICY "Insert alerts" ON alerts FOR INSERT WITH CHECK (true);

-- For inter-cluster critical alert columns and Realtime,
-- see supabase/migrate_critical_alerts.sql
