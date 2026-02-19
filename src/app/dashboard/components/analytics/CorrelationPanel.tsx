'use client';

import React from 'react';
import { CorrelatedVariable } from '@/lib/analytics/types';
import { getFieldLabel, getFieldUnit } from '@/lib/analytics/anomalyDetection';

interface CorrelationPanelProps {
  correlations: CorrelatedVariable[];
}

export function CorrelationPanel({ correlations }: CorrelationPanelProps) {
  if (correlations.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic">
        No significant correlations found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-2">
        Variables that changed simultaneously:
      </p>
      {correlations.map((corr, idx) => {
        const isPositive = corr.correlation > 0;
        const correlationColor = isPositive ? 'text-green-400' : 'text-red-400';
        const deltaColor = corr.deltaValue > 0 ? 'text-green-400' : 'text-red-400';

        return (
          <div
            key={idx}
            className="bg-gray-800/50 rounded p-2 text-xs border border-gray-700"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-gray-300 font-medium">
                {getFieldLabel(corr.field)}
              </span>
              <span className={`font-mono font-semibold ${correlationColor}`}>
                r = {corr.correlation.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                {corr.currentValue.toFixed(2)} {getFieldUnit(corr.field)}
              </span>
              <span className={`font-mono ${deltaColor}`}>
                {corr.deltaValue > 0 ? '+' : ''}
                {corr.deltaValue.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-xs text-gray-500 mt-2">
        <span className="text-green-400">r &gt; 0</span> = positive correlation,{' '}
        <span className="text-red-400">r &lt; 0</span> = negative correlation
      </div>
    </div>
  );
}
