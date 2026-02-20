import { SensorReading } from '@/lib/analytics/types';
import {
  InfectionTrigger,
  InfectionConfig,
  DEFAULT_INFECTION_CONFIG,
} from './types';

/**
 * Analyze a single sensor reading to detect infection triggers
 * Focus on: tVOC (pests), low humidity (drought), low soil moisture (irrigation failure)
 */
export function detectInfectionTriggers(
  reading: SensorReading,
  config: InfectionConfig = DEFAULT_INFECTION_CONFIG
): InfectionTrigger[] {
  const triggers: InfectionTrigger[] = [];

  // Check critical tVOC threshold (pest contamination)
  if (reading.tvoc_ugm3 > config.tvocThreshold) {
    triggers.push({
      type: 'tvoc_critical',
      field: 'tvoc_ugm3',
      value: reading.tvoc_ugm3,
      threshold: config.tvocThreshold,
      message: `Critical tVOC contamination: ${reading.tvoc_ugm3.toFixed(1)} µg/m³ (pest indicator)`,
      severity: 'critical',
    });
  }

  // Check extremely low humidity (drought stress)
  if (reading.relative_humidity_pct < config.lowHumidityThreshold) {
    triggers.push({
      type: 'low_humidity',
      field: 'relative_humidity_pct',
      value: reading.relative_humidity_pct,
      threshold: config.lowHumidityThreshold,
      message: `Extremely low humidity: ${reading.relative_humidity_pct.toFixed(1)}% (drought stress)`,
      severity: 'severe',
    });
  }

  // Check extremely low soil moisture (irrigation failure)
  if (reading.soil_moisture_m3m3 < config.lowSoilMoistureThreshold) {
    triggers.push({
      type: 'low_soil_moisture',
      field: 'soil_moisture_m3m3',
      value: reading.soil_moisture_m3m3,
      threshold: config.lowSoilMoistureThreshold,
      message: `Extremely low soil moisture: ${reading.soil_moisture_m3m3.toFixed(3)} m³/m³ (irrigation failure)`,
      severity: 'critical',
    });
  }

  return triggers;
}


/**
 * Check if a node should become infected based on current reading
 * Simplified: Only checks current values against absolute thresholds
 */
export function shouldNodeBeInfected(
  currentReading: SensorReading,
  timeSeriesReadings: SensorReading[],
  config: InfectionConfig = DEFAULT_INFECTION_CONFIG
): { infected: boolean; triggers: InfectionTrigger[] } {
  // Only check current reading for critical conditions
  const triggers = detectInfectionTriggers(currentReading, config);

  // Node is infected if any triggers exist
  const infected = triggers.length > 0;

  return { infected, triggers };
}

/**
 * Check if a node should recover from infection
 * Recovery is immediate when all readings return to moderate/normal values
 */
export function shouldNodeRecover(
  currentReading: SensorReading,
  infectionStartTime: string,
  currentSimTime: string,
  config: InfectionConfig = DEFAULT_INFECTION_CONFIG
): { shouldRecover: boolean; reason: string } {
  // Check if all critical parameters have normalized
  const reasons: string[] = [];

  // Check tVOC (must be below recovery threshold)
  if (currentReading.tvoc_ugm3 >= config.tvocRecoveryThreshold) {
    reasons.push(`tVOC still elevated: ${currentReading.tvoc_ugm3.toFixed(1)} µg/m³`);
  }

  // Check humidity (must be above recovery threshold)
  if (currentReading.relative_humidity_pct <= config.humidityRecoveryThreshold) {
    reasons.push(`Humidity still low: ${currentReading.relative_humidity_pct.toFixed(1)}%`);
  }

  // Check soil moisture (must be above recovery threshold)
  if (currentReading.soil_moisture_m3m3 <= config.soilMoistureRecoveryThreshold) {
    reasons.push(`Soil moisture still low: ${currentReading.soil_moisture_m3m3.toFixed(3)} m³/m³`);
  }

  // Node recovers only when ALL parameters are in normal range
  if (reasons.length > 0) {
    return {
      shouldRecover: false,
      reason: 'Waiting for normalization: ' + reasons.join(', '),
    };
  }

  return {
    shouldRecover: true,
    reason: 'All parameters normalized - immediate recovery',
  };
}
