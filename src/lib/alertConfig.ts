/**
 * Alert Trigger Configuration
 * 
 * Fine-tune all critical alert thresholds here.
 * Each threshold controls when a specific alert type fires.
 * 
 * ⚙️  To customize: edit the values below and save.
 *     The dashboard will use the new thresholds immediately (after refresh).
 */

export interface AlertThreshold {
  id: string;
  label: string;
  icon: string;
  description: string;
  conditions: ThresholdCondition[];
}

export interface ThresholdCondition {
  sensor: string;
  sensorLabel: string;
  unit: string;
  operator: '>' | '<' | '>=' | '<=';
  value: number;
  description: string;
}

// ─── EDITABLE THRESHOLDS ────────────────────────────────────────────
// Change these values to fine-tune when alerts trigger.

export const ALERT_THRESHOLDS = {
  pest_outbreak: {
    air_temperature_min: 40,       // °C — temp must exceed this
    relative_humidity_min: 85,     // %  — humidity must exceed this
  },
  severe_drought: {
    soil_moisture_max: 0.08,       // m³/m³ — moisture must be below this
    soil_water_tension_min: 60,    // kPa — tension must exceed this
  },
  frost_emergency: {
    air_temperature_max: 1,        // °C — temp must drop below this
  },
  chemical_hazard: {
    tvoc_min: 450,                 // µg/m³ — TVOC must exceed this
    soil_ph_max: 4.8,             // pH — soil pH must be below this
  },
};

// ─── RADIUS CONFIGURATION ──────────────────────────────────────────
export const RADIUS_CONFIG = {
  primary_radius_meters: 100,      // Primary alert zone radius
  fallback_radius_meters: 300,     // If no nodes in primary, search this range
};

// ─── THRESHOLD DEFINITIONS (for UI display) ────────────────────────
export const THRESHOLD_DEFINITIONS: AlertThreshold[] = [
  {
    id: 'pest_outbreak',
    label: 'Pest Outbreak',
    icon: '🐛',
    description: 'Triggers when extreme heat combined with high humidity creates ideal pest breeding conditions.',
    conditions: [
      {
        sensor: 'air_temperature_c',
        sensorLabel: 'Air Temperature',
        unit: '°C',
        operator: '>',
        value: ALERT_THRESHOLDS.pest_outbreak.air_temperature_min,
        description: 'Temperature above this means heat stress + pest risk',
      },
      {
        sensor: 'relative_humidity_pct',
        sensorLabel: 'Relative Humidity',
        unit: '%',
        operator: '>',
        value: ALERT_THRESHOLDS.pest_outbreak.relative_humidity_min,
        description: 'High humidity with heat = pest breeding environment',
      },
    ],
  },
  {
    id: 'severe_drought',
    label: 'Severe Drought',
    icon: '🏜️',
    description: 'Triggers when soil moisture drops critically low and roots struggle to absorb water.',
    conditions: [
      {
        sensor: 'soil_moisture_m3m3',
        sensorLabel: 'Soil Moisture',
        unit: 'm³/m³',
        operator: '<',
        value: ALERT_THRESHOLDS.severe_drought.soil_moisture_max,
        description: 'Moisture below this = permanent wilting point',
      },
      {
        sensor: 'soil_water_tension_kpa',
        sensorLabel: 'Water Tension',
        unit: 'kPa',
        operator: '>',
        value: ALERT_THRESHOLDS.severe_drought.soil_water_tension_min,
        description: 'High tension means roots can\'t extract water',
      },
    ],
  },
  {
    id: 'frost_emergency',
    label: 'Frost Emergency',
    icon: '❄️',
    description: 'Triggers when air temperature drops near or below freezing, risking frost damage to crops.',
    conditions: [
      {
        sensor: 'air_temperature_c',
        sensorLabel: 'Air Temperature',
        unit: '°C',
        operator: '<',
        value: ALERT_THRESHOLDS.frost_emergency.air_temperature_max,
        description: 'Below this temperature, ice crystals form in plant tissue',
      },
    ],
  },
  {
    id: 'chemical_hazard',
    label: 'Chemical Hazard',
    icon: '☣️',
    description: 'Triggers when high volatile compound levels combine with acidic soil, indicating contamination.',
    conditions: [
      {
        sensor: 'tvoc_ugm3',
        sensorLabel: 'TVOC Level',
        unit: 'µg/m³',
        operator: '>',
        value: ALERT_THRESHOLDS.chemical_hazard.tvoc_min,
        description: 'Elevated TVOC suggests chemical spill or pesticide drift',
      },
      {
        sensor: 'soil_ph',
        sensorLabel: 'Soil pH',
        unit: 'pH',
        operator: '<',
        value: ALERT_THRESHOLDS.chemical_hazard.soil_ph_max,
        description: 'Acidic soil compounds chemical contamination risk',
      },
    ],
  },
];
