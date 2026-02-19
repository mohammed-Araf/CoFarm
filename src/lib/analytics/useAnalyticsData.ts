'use client';

import { useState, useEffect, useMemo } from 'react';
import { AnalyticsData } from './types';
import { generateNodeTimeSeries } from './dataGeneration';
import { detectAnomalies } from './anomalyDetection';
import { analyzeAnomaliesWithCorrelations } from './correlationAnalysis';

/**
 * Custom hook to generate and analyze time-series data for a node
 */
export function useAnalyticsData(nodeId: string): AnalyticsData {
  const [loading, setLoading] = useState(true);

  // Generate time-series data (cached)
  const readings = useMemo(() => {
    return generateNodeTimeSeries(nodeId);
  }, [nodeId]);

  // Detect anomalies
  const rawAnomalies = useMemo(() => {
    return detectAnomalies(readings, 2.5, 60);
  }, [readings]);

  // Compute correlations for each anomaly
  const anomalies = useMemo(() => {
    return analyzeAnomaliesWithCorrelations(rawAnomalies, readings);
  }, [rawAnomalies, readings]);

  // Simulate loading state
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 100); // Brief loading state for UX

    return () => clearTimeout(timer);
  }, [nodeId]);

  return {
    readings,
    anomalies,
    loading,
  };
}
