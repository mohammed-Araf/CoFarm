import { generateTimeBasedReading } from '../simulator';
import { SensorReading } from './types';

// Cache to store generated time series data
const timeSeriesCache = new Map<string, SensorReading[]>();

/**
 * Generate 1440 minute time-series data for a node (full 24-hour day)
 * Uses caching to avoid regeneration
 */
export function generateNodeTimeSeries(nodeId: string): SensorReading[] {
  // Check cache first
  if (timeSeriesCache.has(nodeId)) {
    return timeSeriesCache.get(nodeId)!;
  }

  // Generate 1440 readings (one per minute, 0-1439)
  const readings: SensorReading[] = [];

  for (let minute = 0; minute < 1440; minute++) {
    const reading = generateTimeBasedReading(nodeId, minute);
    readings.push({
      ...reading,
      timeMinute: minute,
    });
  }

  // Cache the result
  timeSeriesCache.set(nodeId, readings);

  return readings;
}

/**
 * Clear cache for a specific node or all nodes
 */
export function clearTimeSeriesCache(nodeId?: string): void {
  if (nodeId) {
    timeSeriesCache.delete(nodeId);
  } else {
    timeSeriesCache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: timeSeriesCache.size,
    nodeIds: Array.from(timeSeriesCache.keys()),
  };
}
