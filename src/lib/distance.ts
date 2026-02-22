/**
 * Distance calculation utilities for nodes
 * Uses the same lat/lng to x/y conversion as InfiniteCanvas
 */

interface NodePosition {
  node_id: string;
  latitude: number;
  longitude: number;
}

interface NodeWithDistance extends NodePosition {
  distance: number; // Distance in canvas units (1 unit = 10 meters)
}

// Constants from InfiniteCanvas
const METERS_PER_DEG_LAT = 111320;
const UNIT_METERS = 10;

/**
 * Convert latitude/longitude to x/y canvas coordinates
 * Same logic as InfiniteCanvas.tsx
 */
function latLngToXY(
  lat: number,
  lng: number,
  refLat: number,
  refLng: number
): { x: number; y: number } {
  const deltaLat = lat - refLat;
  const deltaLng = lng - refLng;

  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180);

  const yMeters = deltaLat * METERS_PER_DEG_LAT;
  const xMeters = deltaLng * metersPerDegLng;

  const x = xMeters / UNIT_METERS;
  const y = -yMeters / UNIT_METERS; // Negative to flip Y axis

  return { x, y };
}

/**
 * Calculate distance between two nodes in canvas units
 */
function calculateDistance(
  node1: NodePosition,
  node2: NodePosition,
  refLat: number,
  refLng: number
): number {
  const pos1 = latLngToXY(node1.latitude, node1.longitude, refLat, refLng);
  const pos2 = latLngToXY(node2.latitude, node2.longitude, refLat, refLng);

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distances from a node to all other nodes
 * Returns sorted list (nearest first)
 */
export function calculateNodeDistances(
  sourceNode: NodePosition,
  allNodes: NodePosition[],
  refLat: number,
  refLng: number
): NodeWithDistance[] {
  const distances: NodeWithDistance[] = [];

  for (const targetNode of allNodes) {
    // Skip self
    if (targetNode.node_id === sourceNode.node_id) continue;

    const distance = calculateDistance(sourceNode, targetNode, refLat, refLng);

    distances.push({
      ...targetNode,
      distance,
    });
  }

  // Sort by distance (nearest first)
  distances.sort((a, b) => a.distance - b.distance);

  return distances;
}

/**
 * Calculate distance matrix for all nodes
 * Returns Map<nodeId, Map<otherNodeId, distance>>
 */
export function calculateDistanceMatrix(
  nodes: NodePosition[],
  refLat: number,
  refLng: number
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (const node of nodes) {
    const distances = new Map<string, number>();
    const nodeDistances = calculateNodeDistances(node, nodes, refLat, refLng);

    for (const target of nodeDistances) {
      distances.set(target.node_id, target.distance);
    }

    matrix.set(node.node_id, distances);
  }

  return matrix;
}

/**
 * Get nearest neighbor for a node
 */
export function getNearestNeighbor(
  sourceNode: NodePosition,
  allNodes: NodePosition[],
  refLat: number,
  refLng: number
): NodeWithDistance | null {
  const distances = calculateNodeDistances(sourceNode, allNodes, refLat, refLng);
  return distances.length > 0 ? distances[0] : null;
}

/**
 * Convert canvas distance units to meters
 */
export function unitsToMeters(units: number): number {
  return units * UNIT_METERS;
}

/**
 * Convert canvas distance units to kilometers
 */
export function unitsToKilometers(units: number): number {
  return (units * UNIT_METERS) / 1000;
}

/**
 * Format distance for display
 */
export function formatDistance(units: number): string {
  const meters = unitsToMeters(units);

  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  } else {
    return `${unitsToKilometers(units).toFixed(2)}km`;
  }
}
