'use client';

import { useRouter } from 'next/navigation';
import { THRESHOLD_DEFINITIONS, ALERT_THRESHOLDS, RADIUS_CONFIG } from '@/lib/alertConfig';

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="gradient-bg min-h-screen text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
            <span className="text-sm">⚙️</span>
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Alert Configuration
            </h1>
            <p className="text-[10px] text-gray-500 -mt-0.5">Fine-tune when critical alerts trigger</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Info Banner */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-8 flex items-start gap-3">
          <span className="text-lg mt-0.5">💡</span>
          <div>
            <p className="text-sm text-yellow-400 font-medium mb-1">How to fine-tune thresholds</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Edit the file <code className="text-yellow-300/80 bg-gray-800/60 px-1.5 py-0.5 rounded text-[11px]">src/lib/alertConfig.ts</code> to change when alerts fire.
              Each threshold value is clearly labeled with its unit and purpose. After saving, refresh the dashboard.
            </p>
          </div>
        </div>

        {/* Radius Configuration */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center text-xs">📡</span>
            Alert Radius
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Primary Radius</div>
              <div className="text-2xl font-bold text-purple-400">{RADIUS_CONFIG.primary_radius_meters}m</div>
              <p className="text-[11px] text-gray-500 mt-1">Nodes within this range receive alerts first</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fallback Radius</div>
              <div className="text-2xl font-bold text-purple-400">{RADIUS_CONFIG.fallback_radius_meters}m</div>
              <p className="text-[11px] text-gray-500 mt-1">If no nodes in primary, closest node in this range gets alerted</p>
            </div>
          </div>
        </div>

        {/* Threshold Cards */}
        <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center text-xs">🎯</span>
          Alert Trigger Thresholds
        </h2>

        <div className="space-y-4">
          {THRESHOLD_DEFINITIONS.map((threshold) => (
            <div
              key={threshold.id}
              className="bg-gray-900/60 border border-gray-800/60 rounded-xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-800/40 flex items-center gap-3">
                <span className="text-2xl">{threshold.icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-white">{threshold.label}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">{threshold.description}</p>
                </div>
              </div>

              {/* Conditions */}
              <div className="px-5 py-4 space-y-3">
                {threshold.conditions.map((condition, i) => (
                  <div key={i} className="flex items-center gap-4">
                    {/* Sensor label */}
                    <div className="flex-1">
                      <div className="text-xs text-gray-300 font-medium">{condition.sensorLabel}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{condition.description}</div>
                    </div>
                    {/* Operator + Value */}
                    <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/40">
                      <span className="text-gray-500 text-xs font-mono">{condition.operator}</span>
                      <span className="text-lg font-bold text-white">{condition.value}</span>
                      <span className="text-[10px] text-gray-500">{condition.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Config file reference */}
              <div className="px-5 py-2.5 bg-gray-800/20 border-t border-gray-800/40">
                <p className="text-[10px] text-gray-600">
                  Config key: <code className="text-gray-400">ALERT_THRESHOLDS.{threshold.id}</code>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Raw Config Display */}
        <div className="mt-8 mb-8">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-green-500/15 flex items-center justify-center text-xs">📄</span>
            Raw Configuration
          </h2>
          <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5 overflow-x-auto">
            <pre className="text-xs text-gray-300 font-mono leading-relaxed">
{`// src/lib/alertConfig.ts

export const ALERT_THRESHOLDS = ${JSON.stringify(ALERT_THRESHOLDS, null, 2)};

export const RADIUS_CONFIG = ${JSON.stringify(RADIUS_CONFIG, null, 2)};`}
            </pre>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            Edit the values above in <code className="text-gray-400">src/lib/alertConfig.ts</code> and refresh the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
