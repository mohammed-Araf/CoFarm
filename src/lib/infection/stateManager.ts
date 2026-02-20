import { InfectionState, NodeStatus } from './types';

/**
 * Global infection state manager (client-side only for demo)
 * In production, this would be stored in the database
 */
class InfectionStateManager {
  private states: Map<string, InfectionState> = new Map();

  /**
   * Get infection state for a node
   */
  getState(nodeId: string): InfectionState {
    if (!this.states.has(nodeId)) {
      this.states.set(nodeId, {
        nodeId,
        status: 'online',
        triggers: [],
        anomalyCount: 0,
      });
    }
    return this.states.get(nodeId)!;
  }

  /**
   * Update node status to infected
   */
  setInfected(nodeId: string, triggers: any[], currentTime: string): void {
    this.states.set(nodeId, {
      nodeId,
      status: 'infected',
      infectedAt: currentTime,
      triggers,
      anomalyCount: triggers.length,
    });
  }

  /**
   * Update node status to online (recovered)
   */
  setOnline(nodeId: string): void {
    this.states.set(nodeId, {
      nodeId,
      status: 'online',
      triggers: [],
      anomalyCount: 0,
    });
  }

  /**
   * Update node status to at_risk (neighboring infected node)
   */
  setAtRisk(nodeId: string, nearestInfectedNodeId: string, distance: number): void {
    const current = this.getState(nodeId);
    this.states.set(nodeId, {
      ...current,
      status: 'at_risk',
    });
  }

  /**
   * Update node status to offline
   */
  setOffline(nodeId: string): void {
    const current = this.getState(nodeId);
    this.states.set(nodeId, {
      ...current,
      status: 'offline',
    });
  }

  /**
   * Get status for a node
   */
  getStatus(nodeId: string): NodeStatus {
    return this.getState(nodeId).status;
  }

  /**
   * Get all infection states
   */
  getAllStates(): Map<string, InfectionState> {
    return new Map(this.states);
  }

  /**
   * Clear all states (for testing)
   */
  clearAll(): void {
    this.states.clear();
  }

  /**
   * Check if node is currently infected
   */
  isInfected(nodeId: string): boolean {
    return this.getStatus(nodeId) === 'infected';
  }

  /**
   * Get infection details
   */
  getInfectionDetails(nodeId: string): {
    infected: boolean;
    triggers: any[];
    infectedAt?: string;
  } {
    const state = this.getState(nodeId);
    return {
      infected: state.status === 'infected',
      triggers: state.triggers,
      infectedAt: state.infectedAt,
    };
  }
}

// Singleton instance
export const infectionStateManager = new InfectionStateManager();
