export interface SensorReading {
  timestamp: string;
  soil_moisture_m3m3: number;
  soil_temperature_c: number;
  soil_ec_msm: number;
  soil_ph: number;
  soil_water_tension_kpa: number;
  air_temperature_c: number;
  relative_humidity_pct: number;
  atmospheric_pressure_hpa: number;
  ambient_co2_umolmol: number;
  rainfall_rate_mmh: number;
  tvoc_ugm3: number;
  water_table_depth_m: number;
  solar_irradiance_wm2: number;
  dew_point_c: number;
  vpd_kpa: number;
  frost_risk_flag: string;
  node_id: string;
  timeMinute: number; // 0-1439 for 24-hour simulation
}

export interface Anomaly {
  timeMinute: number;
  field: keyof SensorReading;
  value: number;
  zScore: number;
  expectedMean: number;
  expectedStdDev: number;
  expectedRange: { min: number; max: number };
}

export interface CorrelatedVariable {
  field: keyof SensorReading;
  correlation: number;
  deltaValue: number;
  currentValue: number;
}

export interface AnomalyWithCorrelations extends Anomaly {
  correlations: CorrelatedVariable[];
}

export interface AnalyticsData {
  readings: SensorReading[];
  anomalies: AnomalyWithCorrelations[];
  loading: boolean;
}

export type SensorField =
  | 'air_temperature_c'
  | 'soil_moisture_m3m3'
  | 'relative_humidity_pct'
  | 'ambient_co2_umolmol'
  | 'solar_irradiance_wm2'
  | 'vpd_kpa';

export const SENSOR_CONFIGS: Record<SensorField, { label: string; unit: string; color: string }> = {
  air_temperature_c: { label: 'Air Temperature', unit: '°C', color: '#ef4444' },
  soil_moisture_m3m3: { label: 'Soil Moisture', unit: 'm³/m³', color: '#3b82f6' },
  relative_humidity_pct: { label: 'Relative Humidity', unit: '%', color: '#06b6d4' },
  ambient_co2_umolmol: { label: 'CO₂', unit: 'µmol/mol', color: '#8b5cf6' },
  solar_irradiance_wm2: { label: 'Solar Irradiance', unit: 'W/m²', color: '#f59e0b' },
  vpd_kpa: { label: 'VPD', unit: 'kPa', color: '#10b981' },
};
