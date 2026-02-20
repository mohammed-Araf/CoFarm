'use client';

import { useState } from 'react';
import { SensorReading } from '@/lib/simulator';
import { AnalyticsTab } from './analytics/AnalyticsTab';
import { InfectionStatusPanel } from './InfectionStatusPanel';
import { formatDistance } from '@/lib/distance';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

interface NodeDetailViewProps {
  node: NodeData;
  sensorData: SensorReading | null;
  currentSimMinute: number;
  dbSensorData: SensorReading[]; // From simulator.ts (database readings)
  onBackToMap: () => void;
  distanceMatrix: Map<string, Map<string, number>>;
  allNodes: NodeData[];
}

const sensorFields: { key: keyof SensorReading; label: string; unit: string; icon: string }[] = [
  { key: 'soil_moisture_m3m3', label: 'Soil Moisture', unit: 'm³/m³', icon: '💧' },
  { key: 'soil_temperature_c', label: 'Soil Temp', unit: '°C', icon: '🌡' },
  { key: 'soil_ec_msm', label: 'Soil EC', unit: 'mS/m', icon: '⚡' },
  { key: 'soil_ph', label: 'Soil pH', unit: '', icon: '🧪' },
  { key: 'soil_water_tension_kpa', label: 'Water Tension', unit: 'kPa', icon: '🔬' },
  { key: 'air_temperature_c', label: 'Air Temp', unit: '°C', icon: '🌤' },
  { key: 'relative_humidity_pct', label: 'Humidity', unit: '%', icon: '💨' },
  { key: 'atmospheric_pressure_hpa', label: 'Pressure', unit: 'hPa', icon: '🌀' },
  { key: 'ambient_co2_umolmol', label: 'CO₂', unit: 'µmol/mol', icon: '🫧' },
  { key: 'rainfall_rate_mmh', label: 'Rainfall', unit: 'mm/hr', icon: '🌧' },
  { key: 'tvoc_ugm3', label: 'TVOC', unit: 'µg/m³', icon: '🧫' },
  { key: 'water_table_depth_m', label: 'Water Table', unit: 'm', icon: '🏊' },
  { key: 'solar_irradiance_wm2', label: 'Solar', unit: 'W/m²', icon: '☀️' },
  { key: 'dew_point_c', label: 'Dew Point', unit: '°C', icon: '🌫' },
  { key: 'vpd_kpa', label: 'VPD', unit: 'kPa', icon: '🍃' },
];

export default function NodeDetailView({ node, sensorData, currentSimMinute, dbSensorData, onBackToMap, distanceMatrix, allNodes }: NodeDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

  // Get sorted neighbor distances
  const neighborDistances = (() => {
    const distances = distanceMatrix.get(node.node_id);
    if (!distances) return [];

    const result: Array<{ node: NodeData; distance: number }> = [];
    distances.forEach((distance, nodeId) => {
      const neighborNode = allNodes.find(n => n.node_id === nodeId);
      if (neighborNode) {
        result.push({ node: neighborNode, distance });
      }
    });

    // Sort by distance (nearest first)
    result.sort((a, b) => a.distance - b.distance);
    return result;
  })();

  return (
    <div className="h-full flex flex-col bg-gray-900/90 animate-fadeIn overflow-hidden">
      {/* Map Button and Tab Navigation */}
      <div className="p-4 space-y-3">
        <button
          onClick={onBackToMap}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 border border-gray-700/50 rounded-xl text-gray-300 hover:border-green-500/50 hover:text-green-400 transition-all text-sm cursor-pointer"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:border-gray-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'analytics'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:border-gray-600'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Node Info */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full shadow-lg ${
            node.status === 'infected'
              ? 'bg-red-500 shadow-red-500/50 animate-pulse'
              : node.status === 'at_risk'
              ? 'bg-yellow-500 shadow-yellow-500/50'
              : node.status === 'offline'
              ? 'bg-gray-500 shadow-gray-500/50'
              : 'bg-green-500 shadow-green-500/50 animate-pulse'
          }`} />
          <h2 className="text-lg font-semibold text-white truncate">
            {node.node_id.substring(0, 8)}...
          </h2>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
            node.status === 'online' ? 'bg-green-500/20 text-green-400' :
            node.status === 'infected' ? 'bg-red-500/20 text-red-400' :
            node.status === 'at_risk' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {node.status}
          </span>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>Lat: {node.latitude}</span>
          <span>Lng: {node.longitude}</span>
          {node.elevation_m && <span>Elev: {node.elevation_m}m</span>}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {activeTab === 'overview' ? (
          // Overview Tab - Original sensor data grid
          sensorData ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {sensorFields.map((field) => (
                  <div
                    key={field.key}
                    className="bg-gray-800/50 border border-gray-700/30 rounded-xl p-3 hover:border-green-500/30 transition-all"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{field.icon}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{field.label}</span>
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {typeof sensorData[field.key] === 'number'
                        ? (sensorData[field.key] as number).toFixed(2)
                        : sensorData[field.key]}
                    </div>
                    <div className="text-[10px] text-gray-600">{field.unit}</div>
                  </div>
                ))}
              </div>

              {/* Frost Risk */}
              <div className={`mt-3 p-3 rounded-xl border ${
                sensorData.frost_risk_flag === 'HIGH'
                  ? 'bg-red-500/10 border-red-500/30'
                  : sensorData.frost_risk_flag === 'LOW'
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-green-500/10 border-green-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  <span>❄️</span>
                  <span className="text-sm font-medium text-white">Frost Risk</span>
                  <span className={`ml-auto text-sm font-bold ${
                    sensorData.frost_risk_flag === 'HIGH' ? 'text-red-400' :
                    sensorData.frost_risk_flag === 'LOW' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {sensorData.frost_risk_flag}
                  </span>
                </div>
              </div>

              {/* Infection Status */}
              <div className="mt-3">
                <InfectionStatusPanel
                  nodeId={node.node_id}
                  currentSimTime={sensorData.timestamp}
                />
              </div>

              {/* Neighbor Distances */}
              <div className="mt-3 bg-gray-800/70 rounded-xl p-3 border border-gray-700/50">
                <h4 className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide flex items-center gap-2">
                  <span>📍</span>
                  <span>Network Distances</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {neighborDistances.slice(0, 10).map(({ node: neighbor, distance }) => (
                    <div
                      key={neighbor.node_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-900/50 hover:bg-gray-900/70 transition-all"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            neighbor.status === 'infected'
                              ? 'bg-red-500 animate-pulse'
                              : neighbor.status === 'at_risk'
                              ? 'bg-yellow-500'
                              : neighbor.status === 'offline'
                              ? 'bg-gray-500'
                              : 'bg-green-500'
                          }`}
                        />
                        <span className="text-xs text-gray-300 font-mono truncate">
                          {neighbor.node_id.substring(0, 8)}...
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-gray-400 ml-2 flex-shrink-0">
                        {formatDistance(distance)}
                      </span>
                    </div>
                  ))}
                </div>
                {neighborDistances.length > 10 && (
                  <p className="text-[10px] text-gray-600 mt-2 text-center">
                    Showing nearest 10 of {neighborDistances.length} nodes
                  </p>
                )}
              </div>

              <p className="text-[10px] text-gray-600 mt-3 text-center">
                Last updated: {new Date(sensorData.timestamp).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Waiting for sensor data...
            </div>
          )
        ) : (
          // Analytics Tab - uses actual database sensor data
          <AnalyticsTab
            nodeId={node.node_id}
            currentSimMinute={currentSimMinute}
            dbSensorData={dbSensorData}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
