'use client';

import React, { useMemo } from 'react';
import { SensorReading as AnalyticsSensorReading } from '@/lib/analytics/types';
import { SensorReading as SimulatorSensorReading } from '@/lib/simulator';
import { detectAnomalies } from '@/lib/analytics/anomalyDetection';
import { analyzeAnomaliesWithCorrelations } from '@/lib/analytics/correlationAnalysis';
import { ChartGrid } from './ChartGrid';
import { AnomalyDetectionPanel } from './AnomalyDetectionPanel';

interface AnalyticsTabProps {
  nodeId: string;
  currentSimMinute: number;
  dbSensorData: SimulatorSensorReading[];
}

export function AnalyticsTab({ nodeId, currentSimMinute, dbSensorData }: AnalyticsTabProps) {
  // Convert database readings to include timeMinute
  const readings = useMemo((): AnalyticsSensorReading[] => {
    return dbSensorData.map((reading) => {
      const ts = new Date(reading.timestamp);
      const timeMinute = ts.getUTCHours() * 60 + ts.getUTCMinutes();
      return {
        ...reading,
        timeMinute,
      } as AnalyticsSensorReading;
    });
  }, [dbSensorData]);

  // Detect anomalies from actual database data
  const rawAnomalies = useMemo(() => {
    if (readings.length === 0) return [];
    return detectAnomalies(readings, 2.5, 60);
  }, [readings]);

  // Compute correlations for each anomaly
  const anomalies = useMemo(() => {
    if (rawAnomalies.length === 0) return [];
    return analyzeAnomaliesWithCorrelations(rawAnomalies, readings);
  }, [rawAnomalies, readings]);

  const loading = readings.length === 0;

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
