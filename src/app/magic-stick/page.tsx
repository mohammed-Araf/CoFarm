'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SensorInfo {
  id: string;
  name: string;
  icon: string;
  position: 'solar' | 'top' | 'mid' | 'soil' | 'deep';
  color: string;
  description: string;
  unit: string;
  why: string;
}

const SENSORS: SensorInfo[] = [
  // Solar panel / top of stick
  {
    id: 'solar_irradiance',
    name: 'Solar Irradiance Sensor',
    icon: '☀️',
    position: 'solar',
    color: '#facc15',
    description: 'Measures sunlight intensity hitting the panel surface.',
    unit: 'W/m²',
    why: 'Determines if crops are getting enough sunlight for photosynthesis and helps optimize planting orientation.',
  },
  // Atmospheric sensors (top section)
  {
    id: 'air_temperature',
    name: 'Air Temperature Probe',
    icon: '🌡️',
    position: 'top',
    color: '#ef4444',
    description: 'Precision thermometer measuring ambient air temperature.',
    unit: '°C',
    why: 'Critical for frost detection, pest outbreak prediction, and crop growth cycle management.',
  },
  {
    id: 'relative_humidity',
    name: 'Humidity Sensor',
    icon: '💧',
    position: 'top',
    color: '#3b82f6',
    description: 'Capacitive sensor measuring water vapor in the air.',
    unit: '%',
    why: 'High humidity with heat creates pest breeding conditions. Low humidity causes crop stress.',
  },
  {
    id: 'atmospheric_pressure',
    name: 'Barometric Pressure',
    icon: '🌀',
    position: 'top',
    color: '#8b5cf6',
    description: 'Measures atmospheric pressure for weather prediction.',
    unit: 'hPa',
    why: 'Rapid pressure drops predict storms — giving farmers early warning to protect crops.',
  },
  {
    id: 'ambient_co2',
    name: 'CO₂ Sensor',
    icon: '🫧',
    position: 'top',
    color: '#6366f1',
    description: 'Monitors carbon dioxide concentration in the microclimate.',
    unit: 'µmol/mol',
    why: 'CO₂ levels directly affect photosynthesis rate. Monitoring helps optimize greenhouse ventilation.',
  },
  // Mid section
  {
    id: 'rainfall',
    name: 'Rain Gauge',
    icon: '🌧️',
    position: 'mid',
    color: '#06b6d4',
    description: 'Tipping-bucket gauge measuring precipitation rate.',
    unit: 'mm/h',
    why: 'Tracks water input from rain to adjust irrigation schedules and prevent overwatering.',
  },
  {
    id: 'tvoc',
    name: 'TVOC Detector',
    icon: '🧪',
    position: 'mid',
    color: '#a855f7',
    description: 'Total Volatile Organic Compounds sensor for air quality.',
    unit: 'µg/m³',
    why: 'Detects chemical contamination, pesticide drift, and organic decomposition — early warning for hazards.',
  },
  {
    id: 'dew_point',
    name: 'Dew Point Calculator',
    icon: '🌫️',
    position: 'mid',
    color: '#64748b',
    description: 'Computed from temperature and humidity — the temperature at which dew forms.',
    unit: '°C',
    why: 'Dew formation promotes fungal diseases. Knowing dew point helps time fungicide applications.',
  },
  {
    id: 'vpd',
    name: 'VPD Monitor',
    icon: '🍃',
    position: 'mid',
    color: '#22c55e',
    description: 'Vapor Pressure Deficit — the drying power of the air.',
    unit: 'kPa',
    why: 'Optimal VPD means efficient transpiration. Too high = plant stress; too low = disease risk.',
  },
  {
    id: 'frost_risk',
    name: 'Frost Risk Module',
    icon: '❄️',
    position: 'mid',
    color: '#38bdf8',
    description: 'Real-time frost probability assessment using multi-sensor fusion.',
    unit: 'Flag',
    why: 'Triggers emergency alerts when frost is imminent — saving crops from irreversible frost damage.',
  },
  // Soil sensors (underground)
  {
    id: 'soil_moisture',
    name: 'Soil Moisture Probe',
    icon: '🌱',
    position: 'soil',
    color: '#84cc16',
    description: 'Capacitive probe measuring volumetric water content in soil.',
    unit: 'm³/m³',
    why: 'The most critical irrigation metric. Prevents both drought stress and waterlogging.',
  },
  {
    id: 'soil_temperature',
    name: 'Soil Temperature Probe',
    icon: '🌍',
    position: 'soil',
    color: '#f97316',
    description: 'Buried thermistor measuring soil temperature at root depth.',
    unit: '°C',
    why: 'Soil temp determines seed germination timing and root metabolism rate.',
  },
  {
    id: 'soil_ec',
    name: 'Electrical Conductivity',
    icon: '⚡',
    position: 'soil',
    color: '#eab308',
    description: 'Measures ionic concentration indicating soil salinity and nutrient levels.',
    unit: 'mS/m',
    why: 'High EC means salt buildup from fertilizers. Low EC may indicate nutrient deficiency.',
  },
  {
    id: 'soil_ph',
    name: 'Soil pH Sensor',
    icon: '🔬',
    position: 'soil',
    color: '#14b8a6',
    description: 'Ion-selective electrode measuring soil acidity/alkalinity.',
    unit: 'pH',
    why: 'Nutrient availability depends on pH. Most crops thrive at pH 6.0–7.0.',
  },
  {
    id: 'soil_water_tension',
    name: 'Tensiometer',
    icon: '🎯',
    position: 'soil',
    color: '#f43f5e',
    description: 'Measures soil water tension — how hard roots must work to extract water.',
    unit: 'kPa',
    why: 'Complements moisture readings. High tension means drought — roots can\'t absorb water.',
  },
  {
    id: 'water_table',
    name: 'Water Table Sensor',
    icon: '🌊',
    position: 'deep',
    color: '#0ea5e9',
    description: 'Pressure transducer measuring groundwater depth below the stick.',
    unit: 'm',
    why: 'Rising water table risks root rot. Falling water table signals long-term drought.',
  },
];

const positionLabels = {
  solar: { label: 'Solar Panel', y: 5 },
  top: { label: 'Atmospheric Module', y: 22 },
  mid: { label: 'Weather Station', y: 45 },
  soil: { label: 'Soil Sensors', y: 70 },
  deep: { label: 'Deep Ground', y: 90 },
};

export default function MagicStickPage() {
  const router = useRouter();
  const [selectedSensor, setSelectedSensor] = useState<SensorInfo | null>(null);
  const [hoveredSensor, setHoveredSensor] = useState<string | null>(null);

  return (
    <div className="gradient-bg min-h-screen text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-xl relative z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors mr-2 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
            <span className="text-sm">🪄</span>
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              The Magic Stick
            </h1>
            <p className="text-[10px] text-gray-500 -mt-0.5">C0Farm Sensor Node — 16 Sensors, 1 Stick</p>
          </div>
        </div>
        <span className="text-[11px] text-gray-600 hidden md:block">
          Solar-powered · All-weather · Multi-sensor agricultural intelligence
        </span>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-65px)]">
        {/* Left: 3D Stick Visualization */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 via-transparent to-blue-500/5" />
          <div
            className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
            style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.3), transparent)', top: '10%', left: '30%' }}
          />

          {/* The Stick */}
          <div className="relative" style={{ width: 280, height: 650 }}>
            {/* Solar Panel */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-2" style={{ width: 160 }}>
              {/* Panel surface */}
              <div
                className="relative mx-auto rounded-lg overflow-hidden border border-yellow-500/30"
                style={{
                  width: 140,
                  height: 80,
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)',
                  boxShadow: '0 0 30px rgba(250,204,21,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                  transform: 'perspective(500px) rotateX(15deg)',
                }}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-[1px] p-1 opacity-40">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="bg-blue-900/60 rounded-[1px]" />
                  ))}
                </div>
                {/* Shine */}
                <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-yellow-400/10 to-transparent" />
              </div>
              {/* Panel mount */}
              <div className="mx-auto w-4 h-4 bg-gray-700 rounded-sm" />
            </div>

            {/* Main Stick Body */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: 95,
                width: 18,
                height: 540,
                background: 'linear-gradient(90deg, #374151 0%, #6b7280 40%, #4b5563 60%, #374151 100%)',
                borderRadius: '4px 4px 2px 2px',
                boxShadow: '2px 0 10px rgba(0,0,0,0.3), -2px 0 10px rgba(0,0,0,0.3)',
              }}
            >
              {/* Sections */}
              {/* Atmospheric section highlight */}
              <div
                className="absolute w-full rounded-sm"
                style={{
                  top: 10,
                  height: 120,
                  background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.1), transparent)',
                  borderLeft: '2px solid rgba(59,130,246,0.3)',
                  borderRight: '2px solid rgba(59,130,246,0.3)',
                }}
              />
              {/* Weather section highlight */}
              <div
                className="absolute w-full rounded-sm"
                style={{
                  top: 145,
                  height: 140,
                  background: 'linear-gradient(90deg, transparent, rgba(34,197,94,0.1), transparent)',
                  borderLeft: '2px solid rgba(34,197,94,0.3)',
                  borderRight: '2px solid rgba(34,197,94,0.3)',
                }}
              />
              {/* Ground line */}
              <div
                className="absolute w-[280px] -left-[131px]"
                style={{
                  top: 320,
                  height: 2,
                  background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), transparent)',
                }}
              />
              <div
                className="absolute -left-[60px] text-[9px] text-purple-400/60 uppercase tracking-wider font-semibold"
                style={{ top: 308 }}
              >
                Ground Level
              </div>
              {/* Soil section highlight */}
              <div
                className="absolute w-full rounded-sm"
                style={{
                  top: 330,
                  height: 150,
                  background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.08), transparent)',
                  borderLeft: '2px solid rgba(234,179,8,0.2)',
                  borderRight: '2px solid rgba(234,179,8,0.2)',
                }}
              />
            </div>

            {/* Sensor Dots — positioned along the stick */}
            {SENSORS.map((sensor, i) => {
              const isHovered = hoveredSensor === sensor.id;
              const isSelected = selectedSensor?.id === sensor.id;
              const posGroup = SENSORS.filter(s => s.position === sensor.position);
              const indexInGroup = posGroup.indexOf(sensor);

              // Calculate Y position based on section
              let baseY: number;
              switch (sensor.position) {
                case 'solar': baseY = 40; break;
                case 'top': baseY = 130 + indexInGroup * 28; break;
                case 'mid': baseY = 260 + indexInGroup * 26; break;
                case 'soil': baseY = 430 + indexInGroup * 28; break;
                case 'deep': baseY = 590; break;
              }

              // Alternate left/right
              const side = i % 2 === 0 ? 'left' : 'right';
              const dotX = side === 'left' ? 100 : 180;
              const labelX = side === 'left' ? -10 : 190;

              return (
                <div key={sensor.id}>
                  {/* Connector line */}
                  <div
                    className="absolute transition-all duration-300"
                    style={{
                      top: baseY + 4,
                      left: side === 'left' ? labelX + 115 : 149,
                      width: side === 'left' ? dotX - labelX - 108 : labelX - 149 + 5,
                      height: 1,
                      background: isHovered || isSelected
                        ? sensor.color
                        : `${sensor.color}40`,
                      boxShadow: isHovered || isSelected ? `0 0 6px ${sensor.color}` : 'none',
                    }}
                  />
                  {/* Dot on stick */}
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-300 z-10"
                    style={{
                      top: baseY,
                      left: 138,
                      background: sensor.color,
                      boxShadow: isHovered || isSelected
                        ? `0 0 12px ${sensor.color}, 0 0 24px ${sensor.color}40`
                        : `0 0 4px ${sensor.color}60`,
                      transform: isHovered || isSelected ? 'scale(1.4)' : 'scale(1)',
                    }}
                    onMouseEnter={() => setHoveredSensor(sensor.id)}
                    onMouseLeave={() => setHoveredSensor(null)}
                    onClick={() => setSelectedSensor(sensor)}
                  />
                  {/* Sensor label */}
                  <button
                    className="absolute text-left cursor-pointer transition-all duration-300 group"
                    style={{
                      top: baseY - 6,
                      left: side === 'left' ? labelX - 95 : labelX + 10,
                      width: 110,
                    }}
                    onMouseEnter={() => setHoveredSensor(sensor.id)}
                    onMouseLeave={() => setHoveredSensor(null)}
                    onClick={() => setSelectedSensor(sensor)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{sensor.icon}</span>
                      <span
                        className="text-[10px] font-medium leading-tight transition-colors duration-300"
                        style={{
                          color: isHovered || isSelected ? sensor.color : '#9ca3af',
                        }}
                      >
                        {sensor.name}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}

            {/* Section labels */}
            <div className="absolute -left-2 top-[90px] text-[8px] text-blue-400/50 uppercase tracking-wider font-bold transform -rotate-90 origin-left">
              Atmo
            </div>
            <div className="absolute -left-2 top-[235px] text-[8px] text-green-400/50 uppercase tracking-wider font-bold transform -rotate-90 origin-left">
              Weather
            </div>
            <div className="absolute -left-2 top-[425px] text-[8px] text-yellow-400/50 uppercase tracking-wider font-bold transform -rotate-90 origin-left">
              Soil
            </div>
          </div>
        </div>

        {/* Right: Sensor Detail Panel */}
        <div className="w-96 border-l border-gray-800/80 bg-gray-900/40 backdrop-blur-xl overflow-y-auto">
          {selectedSensor ? (
            <div className="p-6">
              {/* Selected sensor detail */}
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background: `${selectedSensor.color}15`,
                    border: `1px solid ${selectedSensor.color}40`,
                    boxShadow: `0 0 20px ${selectedSensor.color}20`,
                  }}
                >
                  {selectedSensor.icon}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">{selectedSensor.name}</h2>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: `${selectedSensor.color}20`,
                      color: selectedSensor.color,
                    }}
                  >
                    {selectedSensor.unit}
                  </span>
                </div>
              </div>

              {/* What it does */}
              <div className="mb-5">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">What it measures</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{selectedSensor.description}</p>
              </div>

              {/* Why it matters */}
              <div className="mb-5">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Why it matters</h3>
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    background: `${selectedSensor.color}08`,
                    borderColor: `${selectedSensor.color}20`,
                  }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: selectedSensor.color }}>
                    {selectedSensor.why}
                  </p>
                </div>
              </div>

              {/* Position info */}
              <div className="mb-5">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Location on stick</h3>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: selectedSensor.color }}
                  />
                  <span className="text-sm text-gray-400">
                    {positionLabels[selectedSensor.position].label}
                  </span>
                </div>
              </div>

              {/* Tech specs mini */}
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Technical Spec</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
                    <div className="text-[9px] text-gray-500 uppercase">Unit</div>
                    <div className="text-xs text-white font-medium mt-0.5">{selectedSensor.unit}</div>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
                    <div className="text-[9px] text-gray-500 uppercase">Zone</div>
                    <div className="text-xs text-white font-medium mt-0.5 capitalize">{selectedSensor.position}</div>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
                    <div className="text-[9px] text-gray-500 uppercase">Sampling</div>
                    <div className="text-xs text-white font-medium mt-0.5">Every 60s</div>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/30">
                    <div className="text-[9px] text-gray-500 uppercase">Power</div>
                    <div className="text-xs text-white font-medium mt-0.5">Solar</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* No sensor selected — show overview */
            <div className="p-6">
              <div className="text-center mb-8 mt-4">
                <span className="text-5xl mb-4 block">🪄</span>
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent mb-2">
                  The Magic Stick
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  A solar-powered sensor stick that monitors 16 environmental parameters — from atmospheric conditions to deep soil health.
                </p>
              </div>

              <div className="space-y-2 mb-6">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">All Sensors</h3>
                {SENSORS.map((sensor) => (
                  <button
                    key={sensor.id}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:border-gray-600/50 transition-all cursor-pointer group text-left"
                    onMouseEnter={() => setHoveredSensor(sensor.id)}
                    onMouseLeave={() => setHoveredSensor(null)}
                    onClick={() => setSelectedSensor(sensor)}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                      style={{ background: `${sensor.color}15` }}
                    >
                      {sensor.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-gray-300 font-medium group-hover:text-white transition-colors truncate">
                        {sensor.name}
                      </div>
                      <div className="text-[9px] text-gray-600">{sensor.unit}</div>
                    </div>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: sensor.color }}
                    />
                  </button>
                ))}
              </div>

              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-400">16</div>
                    <div className="text-[9px] text-gray-500 uppercase">Sensors</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">☀️</div>
                    <div className="text-[9px] text-gray-500 uppercase">Solar</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400">24/7</div>
                    <div className="text-[9px] text-gray-500 uppercase">Active</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
