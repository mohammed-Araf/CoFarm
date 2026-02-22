'use client';

import { SensorReading } from '@/lib/analytics/types';
import { generateNodeTimeSeries } from '@/lib/analytics/dataGeneration';
import { shouldNodeBeInfected, shouldNodeRecover } from './detection';
import { infectionStateManager } from './stateManager';
import { InfectionConfig, DEFAULT_INFECTION_CONFIG } from './types';

/**
 * Monitor a single node for infection conditions
 */
export function monitorNodeInfection(
  nodeId: string,
  currentReading: SensorReading,
  currentSimTime: string,
  config: InfectionConfig = DEFAULT_INFECTION_CONFIG
): 'online' | 'offline' | 'infected' | 'at_risk' {
  const currentState = infectionStateManager.getState(nodeId);

  // If currently infected, check for recovery
  if (currentState.status === 'infected' && currentState.infectedAt) {
    const { shouldRecover, reason } = shouldNodeRecover(
      currentReading,
      currentState.infectedAt,
      currentSimTime,
      config
    );

    if (shouldRecover) {
      console.log(`[Infection Monitor] Node ${nodeId.substring(0, 8)} recovered: ${reason}`);
      infectionStateManager.setOnline(nodeId);
      return 'online';
    }

    // Still infected
    return 'infected';
  }

  // If currently online, check for infection
  if (currentState.status === 'online') {
    // Generate time series for analysis
    const timeSeries = generateNodeTimeSeries(nodeId);

    const { infected, triggers } = shouldNodeBeInfected(
      currentReading,
      timeSeries,
      config
    );

    if (infected) {
      console.log(
        `[Infection Monitor] Node ${nodeId.substring(0, 8)} INFECTED:`,
        triggers.map((t) => t.message).join(', ')
      );
      infectionStateManager.setInfected(
        nodeId,
        triggers,
        currentSimTime
      );
      return 'infected';
    }
  }

  return currentState.status;
}

/**
 * Monitor multiple nodes for infection
 */
export function monitorAllNodes(
  nodes: Array<{ node_id: string }>,
  getCurrentReading: (nodeId: string) => SensorReading,
  currentSimTime: string,
  config: InfectionConfig = DEFAULT_INFECTION_CONFIG
): Map<string, 'online' | 'offline' | 'infected' | 'at_risk'> {
  const statuses = new Map<string, 'online' | 'offline' | 'infected' | 'at_risk'>();

  for (const node of nodes) {
    const reading = getCurrentReading(node.node_id);
    const status = monitorNodeInfection(node.node_id, reading, currentSimTime, config);
    statuses.set(node.node_id, status);
  }

  return statuses;
}

/**
 * Get infection statistics
 */
export function getInfectionStats(nodeIds: string[]): {
  total: number;
  online: number;
  infected: number;
  offline: number;
} {
  let online = 0;
  let infected = 0;
  let offline = 0;

  for (const nodeId of nodeIds) {
    const status = infectionStateManager.getStatus(nodeId);
    if (status === 'online') online++;
    else if (status === 'infected') infected++;
    else if (status === 'offline') offline++;
  }

  return {
    total: nodeIds.length,
    online,
    infected,
    offline,
  };
}
