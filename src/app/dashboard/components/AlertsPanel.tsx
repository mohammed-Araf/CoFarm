'use client';

import { Alert } from '@/lib/simulator';
import { formatDistance } from '@/lib/distance';
interface AlertsPanelProps {
  alerts: Alert[];
  onAddNode: () => void;
}

const severityConfig = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400', icon: '🔴' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400', icon: '🟠' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400', icon: '🟡' },
  low: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400', icon: '🔵' },
};

const typeIcons: Record<string, string> = {
  pest: '🐛',
  drought: '🏜️',
  frost: '❄️',
  anomaly: '⚠️',
};

export default function AlertsPanel({ alerts, onAddNode }: AlertsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <h2 className="text-sm font-semibold text-white">Alerts</h2>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
              {alerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Regular Alert List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">All clear — no alerts</p>
            <p className="text-[10px] text-gray-600 mt-1">Use test triggers above to simulate</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            const isWarning = alert.alert_type === 'warning';
            const isInfection = alert.alert_type === 'infection';

            return (
              <div
                key={alert.id}
                className={`${config.bg} border ${config.border} rounded-xl p-3 transition-all duration-300 hover:scale-[1.01] ${
                  isInfection ? 'ring-1 ring-red-500/20' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{typeIcons[alert.type] || '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{alert.type}</span>
                      {isWarning && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-md font-medium">
                          ⚠️ WARNING
                        </span>
                      )}
                      {isInfection && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-md font-medium">
                          🔴 INFECTED
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${config.text} leading-relaxed`}>
                      {alert.message}
                    </p>
                    {isWarning && alert.distance !== undefined && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        📍 Distance: {formatDistance(alert.distance)}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">
                      Node: {alert.node_id.substring(0, 8)}... • {new Date(alert.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Node Button */}
      <div className="p-3 border-t border-gray-800/80">
        <button
          onClick={onAddNode}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800/60 border border-dashed border-gray-600/50 rounded-xl text-gray-400 hover:border-green-500/50 hover:text-green-400 transition-all text-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Node
        </button>
      </div>
    </div>
  );
}
