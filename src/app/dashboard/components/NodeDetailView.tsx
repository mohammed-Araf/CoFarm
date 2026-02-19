'use client';

import { SensorReading } from '@/lib/simulator';

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
  onBackToMap: () => void;
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

export default function NodeDetailView({ node, sensorData, onBackToMap }: NodeDetailViewProps) {
  return (
    <div className="h-full flex flex-col bg-gray-900/90 animate-fadeIn overflow-hidden">
      {/* Map Button */}
      <div className="p-4">
        <button
          onClick={onBackToMap}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 border border-gray-700/50 rounded-xl text-gray-300 hover:border-green-500/50 hover:text-green-400 transition-all text-sm cursor-pointer"
        >
          <span>←</span>
          <span>Back</span>
        </button>
      </div>

      {/* Node Info */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
          <h2 className="text-lg font-semibold text-white truncate">
            {node.node_id.substring(0, 8)}...
          </h2>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
            node.status === 'online' ? 'bg-green-500/20 text-green-400' :
            node.status === 'infected' ? 'bg-red-500/20 text-red-400' :
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

      {/* Sensor Data Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {sensorData ? (
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

            <p className="text-[10px] text-gray-600 mt-3 text-center">
              Last updated: {new Date(sensorData.timestamp).toLocaleTimeString()}
            </p>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Waiting for sensor data...
          </div>
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
