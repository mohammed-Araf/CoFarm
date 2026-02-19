'use client';

import { Alert } from '@/lib/simulator';
import {
  CriticalAlert,
  InterClusterAlert,
  CriticalAlertType,
  ALERT_TYPE_CONFIG,
} from '@/lib/alertEngine';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  interClusterAlerts: InterClusterAlert[];
  criticalAlerts: CriticalAlert[];
  ownNodes: NodeData[];
  testTargetNodeId: string;
  userId: string;
  onAddNode: () => void;
  onTestTrigger: (type: CriticalAlertType) => void;
  onClearTestTrigger: () => void;
  onTestNodeChange: (nodeId: string) => void;
  isTestActive: boolean;
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

const TEST_TRIGGERS: { type: CriticalAlertType; label: string; shortDesc: string }[] = [
  { type: 'pest_outbreak',    label: '🐛 Pest',      shortDesc: 'Temp 42°C + Humidity 92%' },
  { type: 'severe_drought',   label: '🏜️ Drought',   shortDesc: 'Moisture 0.05 + Tension 75' },
  { type: 'frost_emergency',  label: '❄️ Frost',      shortDesc: 'Temp -2°C' },
  { type: 'chemical_hazard',  label: '☣️ Chemical',   shortDesc: 'TVOC 500 + pH 4.2' },
];

export default function AlertsPanel({
  alerts,
  interClusterAlerts,
  criticalAlerts,
  ownNodes,
  testTargetNodeId,
  userId,
  onAddNode,
  onTestTrigger,
  onClearTestTrigger,
  onTestNodeChange,
  isTestActive,
}: AlertsPanelProps) {
  const ownCriticalAlerts = criticalAlerts.filter(a => a.sourceClusterId === userId);
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <h2 className="text-sm font-semibold text-white">Alerts</h2>
          {(alerts.length > 0 || criticalAlerts.length > 0) && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
              {alerts.length + criticalAlerts.length}
            </span>
          )}
        </div>
      </div>

      {/* Test Trigger Section */}
      <div className="px-3 py-3 border-b border-gray-800/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">⚡ Test Trigger</span>
          {isTestActive && (
            <button
              onClick={onClearTestTrigger}
              className="text-[10px] px-2 py-0.5 bg-gray-700/60 text-gray-400 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Node Selector */}
        <div className="mb-2">
          <label className="text-[9px] text-gray-500 uppercase tracking-wider block mb-1">Target Node</label>
          <select
            value={testTargetNodeId}
            onChange={(e) => onTestNodeChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800/70 border border-gray-700/50 rounded-lg text-[11px] text-gray-300 focus:border-red-500/50 focus:outline-none transition-colors cursor-pointer appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
          >
            {ownNodes.map((node) => (
              <option key={node.node_id} value={node.node_id}>
                {node.node_id.substring(0, 12)}...
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TEST_TRIGGERS.map(({ type, label, shortDesc }) => {
            const isActive = isTestActive && criticalAlerts.some(a => a.type === type);
            return (
              <button
                key={type}
                onClick={() => onTestTrigger(type)}
                className={`group relative px-2 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-red-500/20 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'bg-gray-800/40 border-gray-700/40 hover:border-red-500/30 hover:bg-red-500/5'
                }`}
              >
                <div className={`text-[11px] font-medium ${isActive ? 'text-red-400' : 'text-gray-300 group-hover:text-red-400'} transition-colors`}>
                  {label}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{shortDesc}</div>
                {isActive && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sender's Own Farm Alert */}
      {ownCriticalAlerts.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-800/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">🚨 Your Farm Alert</span>
          </div>
          <div className="space-y-1.5">
            {ownCriticalAlerts.map((ca) => {
              const cfg = ALERT_TYPE_CONFIG[ca.type];
              return (
                <div
                  key={ca.id}
                  className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-2.5"
                  style={{
                    boxShadow: '0 0 12px rgba(249,115,22,0.15)',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 bg-orange-500/25 text-orange-400 rounded-full font-bold uppercase tracking-wider">
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-orange-300 leading-relaxed">
                        Your node is in critical condition — alert sent to nearby farms
                      </p>
                      <p className="text-[9px] text-gray-500 mt-1">
                        Node: {ca.sourceNodeId.substring(0, 12)}...
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Critical Inter-Cluster Alerts */}
      {interClusterAlerts.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-800/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">⚠️ External Cluster Alerts</span>
            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full font-medium animate-pulse">
              {interClusterAlerts.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {interClusterAlerts.map((ica) => {
              const cfg = ALERT_TYPE_CONFIG[ica.type];
              return (
                <div
                  key={ica.id}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 transition-all duration-500"
                  style={{
                    boxShadow: '0 0 15px rgba(239,68,68,0.15), inset 0 0 15px rgba(239,68,68,0.05)',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 bg-red-500/25 text-red-400 rounded-full font-bold uppercase tracking-wider">
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-red-300 leading-relaxed">
                        Alert sent to external cluster
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-md font-medium">
                          {ica.infectedCount} node{ica.infectedCount !== 1 ? 's' : ''} in radius
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-600 mt-1">
                        {new Date(ica.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular Alert List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {alerts.length === 0 && criticalAlerts.length === 0 ? (
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
            return (
              <div
                key={alert.id}
                className={`${config.bg} border ${config.border} rounded-xl p-3 transition-all duration-300 hover:scale-[1.01]`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{typeIcons[alert.type] || '⚠️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{alert.type}</span>
                    </div>
                    <p className={`text-xs ${config.text} leading-relaxed`}>
                      {alert.message}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {new Date(alert.created_at).toLocaleTimeString()}
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
