'use client';

import React from 'react';
import { TimeSeriesChart } from './TimeSeriesChart';
import { SensorReading, AnomalyWithCorrelations, SENSOR_CONFIGS, SensorField } from '@/lib/analytics/types';

interface ChartGridProps {
  readings: SensorReading[];
  currentSimMinute: number;
  anomalies: AnomalyWithCorrelations[];
}

export function ChartGrid({ readings, currentSimMinute, anomalies }: ChartGridProps) {
  // Define the 6 key sensors to display
  const sensors: SensorField[] = [
    'air_temperature_c',
    'soil_moisture_m3m3',
    'relative_humidity_pct',
    'ambient_co2_umolmol',
    'solar_irradiance_wm2',
    'vpd_kpa',
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sensors.map((field) => {
        const config = SENSOR_CONFIGS[field];
        return (
          <TimeSeriesChart
            key={field}
            data={readings}
            field={field}
            label={config.label}
            unit={config.unit}
            color={config.color}
            currentSimMinute={currentSimMinute}
            anomalies={anomalies}
          />
        );
      })}
    </div>
  );
}
