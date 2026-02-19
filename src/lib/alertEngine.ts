import { SensorReading } from './simulator';
import { ALERT_THRESHOLDS, RADIUS_CONFIG } from './alertConfig';

// ─── Types ───────────────────────────────────────────────────────────

export interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

export type CriticalAlertType = 'pest_outbreak' | 'severe_drought' | 'frost_emergency' | 'chemical_hazard';

export interface CriticalAlert {
  id: string;
  sourceNodeId: string;
  sourceClusterId: string; // user_id of the source node
  type: CriticalAlertType;
  message: string;
  timestamp: string;
  lat: number;
  lng: number;
}

export interface InterClusterAlert {
  id: string;
  sourceNodeId: string;
  sourceClusterId: string;
  targetClusterId: string;
  affectedNodeIds: string[];
  infectedCount: number;
  type: CriticalAlertType;
  message: string;
  timestamp: string;
}

// ─── Alert Line (for canvas rendering) ──────────────────────────────

export interface AlertLine {
  sourceNodeId: string;
  targetNodeId: string;
  type: CriticalAlertType;
}

// ─── Constants (from config) ────────────────────────────────────────

export const ALERT_RADIUS_METERS = RADIUS_CONFIG.primary_radius_meters;
export const FALLBACK_RADIUS_METERS = RADIUS_CONFIG.fallback_radius_meters;

const ALERT_TYPE_CONFIG: Record<CriticalAlertType, { icon: string; label: string; color: string }> = {
  pest_outbreak:    { icon: '🐛', label: 'Pest Outbreak',     color: '#ef4444' },
  severe_drought:   { icon: '🏜️', label: 'Severe Drought',   color: '#f97316' },
  frost_emergency:  { icon: '❄️', label: 'Frost Emergency',   color: '#3b82f6' },
  chemical_hazard:  { icon: '☣️', label: 'Chemical Hazard',   color: '#a855f7' },
};

export { ALERT_TYPE_CONFIG };

// ─── Threshold Evaluation (uses alertConfig.ts values) ──────────────

/**
 * Evaluate if a sensor reading crosses EXTREME thresholds.
 * Thresholds are configured in src/lib/alertConfig.ts
 */
export function evaluateCriticalAlert(
  reading: SensorReading,
  sourceNode: NodeData
): CriticalAlert | null {
  const t = ALERT_THRESHOLDS;

  // Pest outbreak: extreme heat + high humidity
  if (reading.air_temperature_c > t.pest_outbreak.air_temperature_min &&
      reading.relative_humidity_pct > t.pest_outbreak.relative_humidity_min) {
    return makeCriticalAlert(sourceNode, 'pest_outbreak',
      `🐛 PEST OUTBREAK — Extreme heat (${reading.air_temperature_c}°C) + humidity (${reading.relative_humidity_pct}%) creating ideal pest breeding conditions`
    );
  }

  // Severe drought: critically low soil moisture + high water tension
  if (reading.soil_moisture_m3m3 < t.severe_drought.soil_moisture_max &&
      reading.soil_water_tension_kpa > t.severe_drought.soil_water_tension_min) {
    return makeCriticalAlert(sourceNode, 'severe_drought',
      `🏜️ SEVERE DROUGHT — Soil moisture critically low (${reading.soil_moisture_m3m3} m³/m³) with tension at ${reading.soil_water_tension_kpa} kPa`
    );
  }

  // Frost emergency: extreme cold
  if (reading.air_temperature_c < t.frost_emergency.air_temperature_max) {
    return makeCriticalAlert(sourceNode, 'frost_emergency',
      `❄️ FROST EMERGENCY — Temperature dropped to ${reading.air_temperature_c}°C, severe frost damage imminent`
    );
  }

  // Chemical hazard: high TVOC + extreme pH
  if (reading.tvoc_ugm3 > t.chemical_hazard.tvoc_min &&
      reading.soil_ph < t.chemical_hazard.soil_ph_max) {
    return makeCriticalAlert(sourceNode, 'chemical_hazard',
      `☣️ CHEMICAL HAZARD — TVOC at ${reading.tvoc_ugm3} µg/m³ with acidic soil pH ${reading.soil_ph}`
    );
  }

  return null;
}

function makeCriticalAlert(
  node: NodeData,
  type: CriticalAlertType,
  message: string
): CriticalAlert {
  return {
    id: `critical-${node.node_id}-${type}`,
    sourceNodeId: node.node_id,
    sourceClusterId: node.user_id,
    type,
    message,
    timestamp: new Date().toISOString(),
    lat: node.latitude,
    lng: node.longitude,
  };
}

// ─── Radius Calculation (Haversine) ─────────────────────────────────

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find all nodes within a given radius (meters) from a source node.
 * Excludes the source node itself.
 */
export function findNodesInRadius(
  sourceNode: NodeData,
  allNodes: NodeData[],
  radiusMeters: number = ALERT_RADIUS_METERS
): NodeData[] {
  return allNodes.filter((n) => {
    if (n.node_id === sourceNode.node_id) return false;
    const dist = haversineDistance(
      sourceNode.latitude, sourceNode.longitude,
      n.latitude, n.longitude
    );
    return dist <= radiusMeters;
  });
}

/**
 * Find nodes within 100m radius.
 * If none found, fall back to the single closest node within 300m.
 */
export function findNodesWithFallback(
  sourceNode: NodeData,
  allNodes: NodeData[]
): NodeData[] {
  // First try primary radius (100m)
  const primary = findNodesInRadius(sourceNode, allNodes, ALERT_RADIUS_METERS);
  if (primary.length > 0) return primary;

  // Fallback: find the closest single node within 300m
  let closestNode: NodeData | null = null;
  let closestDist = Infinity;

  for (const n of allNodes) {
    if (n.node_id === sourceNode.node_id) continue;
    const dist = haversineDistance(
      sourceNode.latitude, sourceNode.longitude,
      n.latitude, n.longitude
    );
    if (dist <= FALLBACK_RADIUS_METERS && dist < closestDist) {
      closestDist = dist;
      closestNode = n;
    }
  }

  return closestNode ? [closestNode] : [];
}

// ─── Deduplication ──────────────────────────────────────────────────

/**
 * Given a critical alert and the nodes within its radius,
 * produce exactly ONE InterClusterAlert per external cluster.
 * Nodes belonging to the same cluster as the source are excluded.
 */
export function deduplicateClusterAlerts(
  criticalAlert: CriticalAlert,
  nodesInRadius: NodeData[]
): InterClusterAlert[] {
  // Group affected nodes by their cluster (user_id), excluding source cluster
  const clusterMap = new Map<string, string[]>();

  for (const node of nodesInRadius) {
    if (node.user_id === criticalAlert.sourceClusterId) continue;
    const existing = clusterMap.get(node.user_id) || [];
    existing.push(node.node_id);
    clusterMap.set(node.user_id, existing);
  }

  const alerts: InterClusterAlert[] = [];
  for (const [targetClusterId, affectedNodeIds] of clusterMap) {
    alerts.push({
      id: `inter-${criticalAlert.sourceNodeId}-${targetClusterId}-${criticalAlert.type}`,
      sourceNodeId: criticalAlert.sourceNodeId,
      sourceClusterId: criticalAlert.sourceClusterId,
      targetClusterId,
      affectedNodeIds,
      infectedCount: affectedNodeIds.length,
      type: criticalAlert.type,
      message: criticalAlert.message,
      timestamp: criticalAlert.timestamp,
    });
  }

  return alerts;
}

// ─── Test Trigger Overrides ─────────────────────────────────────────

/**
 * Generate sensor readings that are guaranteed to trigger each alert type.
 * Used by the test trigger button.
 */
export function getTestOverrideReading(
  type: CriticalAlertType,
  baseReading: SensorReading
): SensorReading {
  const override = { ...baseReading };

  switch (type) {
    case 'pest_outbreak':
      override.air_temperature_c = 42;
      override.relative_humidity_pct = 92;
      break;
    case 'severe_drought':
      override.soil_moisture_m3m3 = 0.05;
      override.soil_water_tension_kpa = 75;
      break;
    case 'frost_emergency':
      override.air_temperature_c = -2;
      override.frost_risk_flag = 'HIGH';
      break;
    case 'chemical_hazard':
      override.tvoc_ugm3 = 500;
      override.soil_ph = 4.2;
      break;
  }

  return override;
}

// ─── Build Alert Lines for Canvas ───────────────────────────────────

export function buildAlertLines(
  criticalAlerts: CriticalAlert[],
  interClusterAlerts: InterClusterAlert[]
): AlertLine[] {
  const lines: AlertLine[] = [];

  for (const ica of interClusterAlerts) {
    for (const targetNodeId of ica.affectedNodeIds) {
      lines.push({
        sourceNodeId: ica.sourceNodeId,
        targetNodeId,
        type: ica.type,
      });
    }
  }

  return lines;
}
