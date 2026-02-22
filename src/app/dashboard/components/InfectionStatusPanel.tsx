'use client';

import React from 'react';
import { infectionStateManager } from '@/lib/infection';

interface InfectionStatusPanelProps {
  nodeId: string;
  currentSimTime: string;
}

export function InfectionStatusPanel({ nodeId, currentSimTime }: InfectionStatusPanelProps) {
  const infectionState = infectionStateManager.getState(nodeId);

  if (infectionState.status !== 'infected') {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">✓</span>
          <div className="flex-1">
            <span className="text-sm font-medium text-green-400">Node Status: Healthy</span>
            <p className="text-xs text-gray-400 mt-0.5">
              No contamination or anomalies detected
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate time infected
  const now = new Date(currentSimTime);
  const infectedAt = infectionState.infectedAt
    ? new Date(infectionState.infectedAt)
    : null;
  const minutesInfected = infectedAt
    ? Math.floor((now.getTime() - infectedAt.getTime()) / (1000 * 60))
    : 0;

  return (
    <div className="space-y-3">
      {/* Status Banner */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <span className="text-xl animate-pulse">⚠️</span>
          <div className="flex-1">
            <span className="text-sm font-bold text-red-400">NODE INFECTED</span>
            <p className="text-xs text-gray-400 mt-0.5">
              Critical contamination detected
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Infected for</div>
            <div className="text-lg font-mono font-bold text-red-400">
              {Math.floor(minutesInfected / 60)}h {minutesInfected % 60}m
            </div>
          </div>
        </div>
      </div>

      {/* Infection Details */}
      <div className="bg-gray-800/70 rounded-xl p-3 border border-red-500/20">
        <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">
          Infection Analysis
        </h4>

        {/* Timeline */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          <div className="flex-1">
            <div className="text-gray-500">Active Triggers</div>
            <div className="text-white font-semibold">
              {infectionState.triggers.length}
            </div>
          </div>
        </div>

        {/* Triggers */}
        <div className="space-y-2">
          <div className="text-xs text-gray-400 mb-1">Contamination Sources:</div>
          {infectionState.triggers.map((trigger, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg border text-xs ${
                trigger.severity === 'critical'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-orange-500/10 border-orange-500/30'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">
                  {trigger.severity === 'critical' ? '🔴' : '🟠'}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-white mb-0.5">
                    {trigger.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div className="text-gray-300">{trigger.message}</div>
                  {trigger.value !== undefined && trigger.threshold !== undefined && (
                    <div className="text-gray-500 mt-1 font-mono text-[10px]">
                      Value: {trigger.value.toFixed(2)} / Threshold: {trigger.threshold}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recovery Info */}
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            💊 Recovery protocol: Node will automatically recover when all sensor readings return to normal ranges (tVOC &lt; 80 µg/m³, humidity &gt; 25%, soil moisture &gt; 0.15 m³/m³).
          </div>
        </div>
      </div>
    </div>
  );
}
