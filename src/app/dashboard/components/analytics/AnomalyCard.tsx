'use client';

import React, { useState } from 'react';
import { AnomalyWithCorrelations } from '@/lib/analytics/types';
import { formatTimeMinute, getFieldLabel, getFieldUnit } from '@/lib/analytics/anomalyDetection';
import { CorrelationPanel } from './CorrelationPanel';

interface AnomalyCardProps {
  anomaly: AnomalyWithCorrelations;
}

export function AnomalyCard({ anomaly }: AnomalyCardProps) {
  const [expanded, setExpanded] = useState(false);

  const severityColor =
    Math.abs(anomaly.zScore) > 4
      ? 'border-red-500'
      : Math.abs(anomaly.zScore) > 3
        ? 'border-orange-500'
        : 'border-yellow-500';

  return (
    <div className={`bg-gray-800/70 rounded-lg p-3 border ${severityColor}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-sm font-semibold text-white">
            {getFieldLabel(anomaly.field)}
          </h4>
          <p className="text-xs text-gray-400">
            {formatTimeMinute(anomaly.timeMinute)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-semibold text-red-400">
            {anomaly.value.toFixed(2)} {getFieldUnit(anomaly.field)}
          </p>
          <p className="text-xs text-gray-400">
            Z-score: {anomaly.zScore.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Expected range */}
      <div className="bg-gray-900/50 rounded p-2 mb-2 text-xs">
        <p className="text-gray-400 mb-1">Expected range:</p>
        <p className="text-gray-300 font-mono">
          {anomaly.expectedRange.min.toFixed(2)} - {anomaly.expectedRange.max.toFixed(2)}{' '}
          {getFieldUnit(anomaly.field)}
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Mean: {anomaly.expectedMean.toFixed(2)} ± {anomaly.expectedStdDev.toFixed(2)}
        </p>
      </div>

      {/* Correlations toggle */}
      {anomaly.correlations.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-green-400 hover:text-green-300 font-medium flex items-center justify-center gap-1 py-1"
          >
            {expanded ? '▼' : '▶'} {expanded ? 'Hide' : 'View'} Correlations (
            {anomaly.correlations.length})
          </button>

          {expanded && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <CorrelationPanel correlations={anomaly.correlations} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
