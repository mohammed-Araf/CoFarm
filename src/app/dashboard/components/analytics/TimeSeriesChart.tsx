'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  CartesianGrid,
} from 'recharts';
import { SensorReading, AnomalyWithCorrelations, SensorField } from '@/lib/analytics/types';

interface TimeSeriesChartProps {
  data: SensorReading[];
  field: SensorField;
  label: string;
  unit: string;
  color: string;
  currentSimMinute: number;
  anomalies: AnomalyWithCorrelations[];
}

export function TimeSeriesChart({
  data,
  field,
  label,
  unit,
  color,
  currentSimMinute,
  anomalies,
}: TimeSeriesChartProps) {
  // Filter anomalies for this field
  const fieldAnomalies = anomalies.filter((a) => a.field === field);

  // Format time for display
  const formatTime = (minute: number) => {
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 shadow-lg">
          <p className="text-gray-300 text-xs mb-1">{formatTime(data.timeMinute)}</p>
          <p className="text-white font-semibold">
            {payload[0].value.toFixed(2)} {unit}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">
        {label} ({unit})
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timeMinute"
            tickFormatter={formatTime}
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#4b5563"
            ticks={[0, 360, 720, 1080, 1439]}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            stroke="#4b5563"
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey={field}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* Current simulation time */}
          <ReferenceLine
            x={currentSimMinute}
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="3 3"
            label={{ value: 'Now', fill: '#10b981', fontSize: 10, position: 'top' }}
          />
          {/* Anomaly markers */}
          {fieldAnomalies.map((anomaly, idx) => (
            <ReferenceDot
              key={idx}
              x={anomaly.timeMinute}
              y={anomaly.value}
              r={5}
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
