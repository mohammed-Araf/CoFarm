import { SensorReading, Anomaly, CorrelatedVariable, AnomalyWithCorrelations } from './types';

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Extract time window around anomaly
 */
function extractTimeWindow(
  readings: SensorReading[],
  anomalyTime: number,
  windowMinutes: number = 30
): SensorReading[] {
  const startTime = Math.max(0, anomalyTime - windowMinutes);
  const endTime = Math.min(1439, anomalyTime + windowMinutes);

  return readings.filter(
    (r) => r.timeMinute >= startTime && r.timeMinute <= endTime
  );
}

/**
 * Compute correlation matrix for all sensor fields around an anomaly
 */
export function computeCorrelationMatrix(
  readings: SensorReading[],
  anomaly: Anomaly,
  windowMinutes: number = 30
): Map<string, Map<string, number>> {
  const windowData = extractTimeWindow(readings, anomaly.timeMinute, windowMinutes);

  // Fields to analyze
  const fields: (keyof SensorReading)[] = [
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

  const matrix = new Map<string, Map<string, number>>();

  // Compute correlations
  for (const field1 of fields) {
    const row = new Map<string, number>();
    const values1 = windowData.map((r) => r[field1] as number);

    for (const field2 of fields) {
      const values2 = windowData.map((r) => r[field2] as number);
      const correlation = pearsonCorrelation(values1, values2);
      row.set(field2, correlation);
    }

    matrix.set(field1, row);
  }

  return matrix;
}

/**
 * Get top correlated variables for an anomaly
 */
export function getTopCorrelations(
  anomaly: Anomaly,
  readings: SensorReading[],
  correlationThreshold: number = 0.7,
  topN: number = 5
): CorrelatedVariable[] {
  const matrix = computeCorrelationMatrix(readings, anomaly);
  const anomalyFieldCorrelations = matrix.get(anomaly.field);

  if (!anomalyFieldCorrelations) return [];

  // Find anomaly reading
  const anomalyReading = readings.find((r) => r.timeMinute === anomaly.timeMinute);
  if (!anomalyReading) return [];

  // Extract correlations and filter
  const correlations: CorrelatedVariable[] = [];

  anomalyFieldCorrelations.forEach((correlation, field) => {
    // Skip self-correlation and weak correlations
    if (field === anomaly.field || Math.abs(correlation) < correlationThreshold) {
      return;
    }

    const currentValue = anomalyReading[field as keyof SensorReading] as number;

    // Calculate delta (how much this field changed)
    const windowData = extractTimeWindow(readings, anomaly.timeMinute);
    const fieldValues = windowData.map((r) => r[field as keyof SensorReading] as number);
    const fieldMean = fieldValues.reduce((a, b) => a + b, 0) / fieldValues.length;
    const deltaValue = currentValue - fieldMean;

    correlations.push({
      field: field as keyof SensorReading,
      correlation,
      deltaValue,
      currentValue,
    });
  });

  // Sort by absolute correlation value (descending)
  correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  // Return top N
  return correlations.slice(0, topN);
}

/**
 * Analyze all anomalies and add correlation data
 */
export function analyzeAnomaliesWithCorrelations(
  anomalies: Anomaly[],
  readings: SensorReading[]
): AnomalyWithCorrelations[] {
  return anomalies.map((anomaly) => ({
    ...anomaly,
    correlations: getTopCorrelations(anomaly, readings),
  }));
}
