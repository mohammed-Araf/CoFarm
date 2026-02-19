import { SensorReading, Anomaly } from './types';

interface RollingStats {
  mean: number;
  stdDev: number;
}

/**
 * Compute rolling mean and standard deviation for a time window
 */
function computeRollingStats(
  data: number[],
  index: number,
  windowSize: number
): RollingStats {
  // Use expanding window for first windowSize elements
  const start = Math.max(0, index - windowSize + 1);
  const window = data.slice(start, index + 1);

  // Calculate mean
  const mean = window.reduce((sum, val) => sum + val, 0) / window.length;

  // Calculate standard deviation
  const variance =
    window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Detect anomalies using modified Z-score with rolling window
 * @param readings - Array of sensor readings
 * @param threshold - Z-score threshold (default: 2.5)
 * @param windowSize - Rolling window size in minutes (default: 60)
 * @returns Array of detected anomalies
 */
export function detectAnomalies(
  readings: SensorReading[],
  threshold: number = 2.5,
  windowSize: number = 60
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Fields to analyze for anomalies
  const fieldsToAnalyze: (keyof SensorReading)[] = [
    'air_temperature_c',
    'soil_moisture_m3m3',
    'soil_temperature_c',
    'soil_ec_msm',
    'soil_ph',
    'soil_water_tension_kpa',
    'relative_humidity_pct',
    'dew_point_c',
    'ambient_co2_umolmol',
    'tvoc_ugm3',
    'solar_irradiance_wm2',
    'atmospheric_pressure_hpa',
    'rainfall_rate_mmh',
    'water_table_depth_m',
    'vpd_kpa',
  ];

  for (const field of fieldsToAnalyze) {
    // Extract values for this field
    const values = readings.map((r) => r[field] as number);

    // Analyze each data point
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const stats = computeRollingStats(values, i, windowSize);

      // Skip if standard deviation is zero (no variation)
      if (stats.stdDev === 0) continue;

      // Calculate Z-score
      const zScore = (value - stats.mean) / stats.stdDev;

      // Check if anomaly
      if (Math.abs(zScore) > threshold) {
        anomalies.push({
          timeMinute: readings[i].timeMinute,
          field,
          value,
          zScore,
          expectedMean: stats.mean,
          expectedStdDev: stats.stdDev,
          expectedRange: {
            min: stats.mean - threshold * stats.stdDev,
            max: stats.mean + threshold * stats.stdDev,
          },
        });
      }
    }
  }

  // Sort anomalies by time
  anomalies.sort((a, b) => a.timeMinute - b.timeMinute);

  return anomalies;
}

/**
 * Format time minute to HH:MM string
 */
export function formatTimeMinute(minute: number): string {
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get human-readable field name
 */
export function getFieldLabel(field: keyof SensorReading): string {
  const labels: Record<string, string> = {
    air_temperature_c: 'Air Temperature',
    soil_moisture_m3m3: 'Soil Moisture',
    soil_temperature_c: 'Soil Temperature',
    soil_ec_msm: 'Soil EC',
    soil_ph: 'Soil pH',
    soil_water_tension_kpa: 'Water Tension',
    relative_humidity_pct: 'Relative Humidity',
    dew_point_c: 'Dew Point',
    ambient_co2_umolmol: 'CO₂',
    tvoc_ugm3: 'TVOC',
    solar_irradiance_wm2: 'Solar Irradiance',
    atmospheric_pressure_hpa: 'Atmospheric Pressure',
    rainfall_rate_mmh: 'Rainfall Rate',
    water_table_depth_m: 'Water Table Depth',
    vpd_kpa: 'VPD',
    frost_risk_flag: 'Frost Risk',
    timestamp: 'Timestamp',
    node_id: 'Node ID',
    timeMinute: 'Time',
  };
  return labels[field] || field;
}

/**
 * Get unit for field
 */
export function getFieldUnit(field: keyof SensorReading): string {
  const units: Record<string, string> = {
    air_temperature_c: '°C',
    soil_moisture_m3m3: 'm³/m³',
    soil_temperature_c: '°C',
    soil_ec_msm: 'mS/m',
    soil_ph: '',
    soil_water_tension_kpa: 'kPa',
    relative_humidity_pct: '%',
    dew_point_c: '°C',
    ambient_co2_umolmol: 'µmol/mol',
    tvoc_ugm3: 'µg/m³',
    solar_irradiance_wm2: 'W/m²',
    atmospheric_pressure_hpa: 'hPa',
    rainfall_rate_mmh: 'mm/hr',
    water_table_depth_m: 'm',
    vpd_kpa: 'kPa',
    frost_risk_flag: '',
    timestamp: '',
    node_id: '',
    timeMinute: 'min',
  };
  return units[field] || '';
}
