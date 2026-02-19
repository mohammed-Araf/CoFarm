'use client';

import React from 'react';
import { AnomalyWithCorrelations } from '@/lib/analytics/types';
import { AnomalyCard } from './AnomalyCard';

interface AnomalyDetectionPanelProps {
  anomalies: AnomalyWithCorrelations[];
}

export function AnomalyDetectionPanel({ anomalies }: AnomalyDetectionPanelProps) {
  if (anomalies.length === 0) {
    return (
      <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800 text-center">
        <div className="text-4xl mb-2">✓</div>
        <p className="text-gray-300 font-semibold">No anomalies detected</p>
        <p className="text-gray-400 text-sm mt-1">
          All sensor readings are within expected ranges
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Detected Anomalies ({anomalies.length})
        </h3>
        <span className="text-xs text-gray-400">
          Z-score threshold: 2.5σ
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
        {anomalies.map((anomaly, idx) => (
          <AnomalyCard key={idx} anomaly={anomaly} />
        ))}
      </div>
    </div>
  );
}
