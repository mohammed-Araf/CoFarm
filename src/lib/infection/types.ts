import { SensorReading } from '@/lib/analytics/types';

export type NodeStatus = 'online' | 'offline' | 'infected' | 'at_risk';

export interface InfectionTrigger {
  type: 'tvoc_critical' | 'low_humidity' | 'low_soil_moisture';
  field: keyof SensorReading;
  value: number;
  threshold: number;
  message: string;
  severity: 'critical' | 'severe';
}

export interface InfectionState {
  nodeId: string;
  status: NodeStatus;
  infectedAt?: string; // ISO timestamp
  triggers: InfectionTrigger[];
  anomalyCount: number;
}

export interface InfectionConfig {
  // Critical tVOC threshold (pest contamination)
  tvocThreshold: number; // Default: 90 µg/m³

  // Extremely low humidity threshold (drought stress)
  lowHumidityThreshold: number; // Default: 20%

  // Extremely low soil moisture threshold (irrigation failure)
  lowSoilMoistureThreshold: number; // Default: 0.10 m³/m³

  // Recovery thresholds (moderate/normal values)
  tvocRecoveryThreshold: number; // Default: 80 µg/m³
  humidityRecoveryThreshold: number; // Default: 25%
  soilMoistureRecoveryThreshold: number; // Default: 0.15 m³/m³
}

export const DEFAULT_INFECTION_CONFIG: InfectionConfig = {
  tvocThreshold: 90,
  lowHumidityThreshold: 20,
  lowSoilMoistureThreshold: 0.10,
  tvocRecoveryThreshold: 80,
  humidityRecoveryThreshold: 25,
  soilMoistureRecoveryThreshold: 0.15,
};

/**
 * Fields that are heavily diurnal (follow day/night cycles)
 * These should NOT be used for infection detection as extreme values
 * are expected at certain times of day
 */
export const DIURNAL_FIELDS: Set<keyof SensorReading> = new Set([
  'solar_irradiance_wm2',  // Follows sun angle - peaks at noon
  'air_temperature_c',     // Peaks in afternoon (14:00)
  'soil_temperature_c',    // Follows air temp with ~2h lag
  'vpd_kpa',               // Vapor pressure deficit - correlates with temp
  'dew_point_c',           // Follows temperature/humidity cycles
]);

/**
 * Fields that are normally distributed or event-based (non-diurnal)
 * These are monitored for infection triggers as extreme values
 * indicate actual problems, not natural cycles
 */
export const NON_DIURNAL_FIELDS: (keyof SensorReading)[] = [
  'soil_moisture_m3m3',      // Relatively stable, slow changes
  'soil_ec_msm',             // Electrical conductivity - stable
  'soil_ph',                 // Very stable over time
  'soil_water_tension_kpa',  // Relatively stable
  'relative_humidity_pct',   // Some diurnal but extremes are problematic
  'ambient_co2_umolmol',     // Some diurnal but extremes are problematic
  'tvoc_ugm3',               // CRITICAL: Pest infection indicator
  'atmospheric_pressure_hpa', // Weather-related, normally distributed
  'rainfall_rate_mmh',       // Event-based, not diurnal
  'water_table_depth_m',     // Very stable over time
];
