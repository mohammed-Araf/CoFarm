'use client';

import React from 'react';
import { useAnalyticsData } from '@/lib/analytics/useAnalyticsData';
import { ChartGrid } from './ChartGrid';
import { AnomalyDetectionPanel } from './AnomalyDetectionPanel';

interface AnalyticsTabProps {
  nodeId: string;
  currentSimMinute: number;
}

export function AnalyticsTab({ nodeId, currentSimMinute }: AnalyticsTabProps) {
  const { readings, anomalies, loading } = useAnalyticsData(nodeId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
          <p className="text-gray-300">Generating time-series data...</p>
          <p className="text-gray-400 text-sm mt-1">Analyzing 1440 minutes of sensor readings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time-Series Charts */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">
          24-Hour Sensor Patterns
        </h3>
        <ChartGrid
          readings={readings}
          currentSimMinute={currentSimMinute}
          anomalies={anomalies}
        />
      </div>

      {/* Anomaly Detection */}
      <div>
        <AnomalyDetectionPanel anomalies={anomalies} />
      </div>
    </div>
  );
}
