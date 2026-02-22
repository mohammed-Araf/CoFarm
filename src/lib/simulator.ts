// Generates realistic simulated sensor data for farm nodes

export interface SensorReading {
  timestamp: string;
  soil_moisture_m3m3: number;
  soil_temperature_c: number;
  soil_ec_msm: number;
  soil_ph: number;
  soil_water_tension_kpa: number;
  air_temperature_c: number;
  relative_humidity_pct: number;
  atmospheric_pressure_hpa: number;
  ambient_co2_umolmol: number;
  rainfall_rate_mmh: number;
  tvoc_ugm3: number;
  water_table_depth_m: number;
  solar_irradiance_wm2: number;
  dew_point_c: number;
  vpd_kpa: number;
  frost_risk_flag: string;
  node_id: string;
}

export interface Alert {
  id: string;
  type: 'pest' | 'drought' | 'frost' | 'anomaly';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  node_id: string;
  created_at: string;
  alert_type: 'warning' | 'infection';
  source_node_id?: string; // For warnings: the infected neighbor node
  distance?: number; // For warnings: distance to infected neighbor (in canvas units)
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

export function generateSensorReading(nodeId: string): SensorReading {
  const airTemp = rand(15, 42);
  const humidity = rand(30, 95);
  const dewPoint = airTemp - ((100 - humidity) / 5);
  const vpd = ((0.6108 * Math.exp((17.27 * airTemp) / (airTemp + 237.3))) *
    (1 - humidity / 100)) / 10;

  return {
    timestamp: new Date().toISOString(),
    soil_moisture_m3m3: rand(0.05, 0.55),
    soil_temperature_c: rand(10, 38),
    soil_ec_msm: rand(0.1, 5.0),
    soil_ph: rand(4.5, 8.5),
    soil_water_tension_kpa: rand(5, 80),
    air_temperature_c: airTemp,
    relative_humidity_pct: humidity,
    atmospheric_pressure_hpa: rand(990, 1030),
    ambient_co2_umolmol: rand(350, 600),
    rainfall_rate_mmh: Math.random() > 0.7 ? rand(0, 25) : 0,
    tvoc_ugm3: rand(10, 500),
    water_table_depth_m: rand(0.5, 5),
    solar_irradiance_wm2: rand(0, 1200),
    dew_point_c: Math.round(dewPoint * 100) / 100,
    vpd_kpa: Math.round(vpd * 100) / 100,
    frost_risk_flag: airTemp < 3 ? 'HIGH' : airTemp < 8 ? 'LOW' : 'NONE',
    node_id: nodeId,
  };
}

/**
 * Simple seeded PRNG for deterministic per-node variation.
 * Returns a value in [0, 1).
 */
function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a time-based sensor reading with realistic diurnal patterns.
 * @param nodeId - The node identifier
 * @param simMinutes - Minutes since midnight (0–1439), representing simulated time
 */
export function generateTimeBasedReading(nodeId: string, simMinutes: number): SensorReading {
  const hour = simMinutes / 60;
  // Node-specific seed offset so different nodes show slightly different values
  let nodeSeed = 0;
  for (let i = 0; i < nodeId.length; i++) nodeSeed += nodeId.charCodeAt(i);
  const nv = (offset: number) => seededRand(nodeSeed + offset + Math.floor(simMinutes / 5) * 0.1);

  // --- Diurnal patterns ---

  // Solar irradiance: bell curve peaking at noon (hour 12), zero at night
  const solarAngle = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const solarIrradiance = Math.round(solarAngle * (900 + nv(1) * 300) * 100) / 100;

  // Air temperature: peaks around 14:00, lowest around 05:00
  const tempBase = 12 + 18 * Math.sin(((hour - 5) / 24) * Math.PI * 2 * 0.5);
  const airTemp = Math.round((tempBase + (nv(2) - 0.5) * 6) * 100) / 100;

  // Soil temperature: lags air by ~2 hours, smaller amplitude
  const soilTempBase = 15 + 10 * Math.sin(((hour - 7) / 24) * Math.PI * 2 * 0.5);
  const soilTemp = Math.round((soilTempBase + (nv(3) - 0.5) * 4) * 100) / 100;

  // Humidity: high at night/morning, low in afternoon
  const humidityBase = 80 - 40 * solarAngle;
  const humidity = Math.round(Math.max(25, Math.min(98, humidityBase + (nv(4) - 0.5) * 15)) * 100) / 100;

  // Soil moisture: gradual decrease during day, slight recovery at night
  // Occasional equipment failures cause extreme drops
  let moistureBase = 0.35 - 0.12 * solarAngle;
  const moistureFailureSeed = nodeSeed + Math.floor(simMinutes / 180); // Changes every 3 hours
  const moistureFailure = seededRand(moistureFailureSeed);

  // ~5% chance of sensor/equipment failure (extreme drop)
  if (moistureFailure > 0.95) {
    moistureBase = 0.05 + nv(5) * 0.05; // 0.05-0.10 (extreme low, triggers infection)
  }

  const soilMoisture = Math.round(Math.max(0.05, Math.min(0.55, moistureBase + (nv(5) - 0.5) * 0.08)) * 100) / 100;

  // CO2: higher at night (plant respiration), lower during day (photosynthesis)
  const co2Base = 480 - 100 * solarAngle;
  const co2 = Math.round((co2Base + (nv(6) - 0.5) * 40) * 100) / 100;

  // Atmospheric pressure: slight diurnal variation
  const pressure = Math.round((1013 + 5 * Math.sin(((hour) / 12) * Math.PI) + (nv(7) - 0.5) * 8) * 100) / 100;

  // Rainfall: more likely in early morning/evening
  const rainChance = hour > 3 && hour < 7 ? 0.3 : hour > 16 && hour < 20 ? 0.25 : 0.05;
  const rainfall = nv(8) < rainChance ? Math.round(nv(9) * 15 * 100) / 100 : 0;

  // Derived values
  const dewPoint = Math.round((airTemp - ((100 - humidity) / 5)) * 100) / 100;
  const vpd = Math.round(((0.6108 * Math.exp((17.27 * airTemp) / (airTemp + 237.3))) *
    (1 - humidity / 100)) / 10 * 100) / 100;

  const soilEc = Math.round((1.2 + (nv(10) - 0.5) * 2 + solarAngle * 0.8) * 100) / 100;

  // Soil pH: normally stable around 6.5
  // Occasional chemical spills cause extreme pH shifts
  let soilPhBase = 6.5 + (nv(11) - 0.5) * 1.0;
  const phAnomalySeed = nodeSeed + Math.floor(simMinutes / 200);
  const phAnomaly = seededRand(phAnomalySeed);

  // ~3% chance of chemical contamination (extreme pH shift)
  if (phAnomaly > 0.97) {
    // Acidic or alkaline spill
    soilPhBase = seededRand(phAnomalySeed + 1) > 0.5 ? 4.0 : 8.5; // Extreme pH
  }

  const soilPh = Math.round(soilPhBase * 100) / 100;
  const waterTension = Math.round((20 + solarAngle * 30 + (nv(12) - 0.5) * 15) * 100) / 100;

  // tVOC with pest infection events
  // Base level: 10-60 µg/m³ (normal background)
  // Pest events can spike to 90-150 µg/m³ (infection threshold: 90)
  let tvoc = 30 + (nv(13) - 0.5) * 40; // Base: 10-50 µg/m³

  // Pest activity increases with warmth (air temp > 25°C) and during day
  if (airTemp > 25 && solarAngle > 0.3) {
    // Check if this node/time has a pest event (use deterministic seed)
    const pestEventSeed = nodeSeed + Math.floor(simMinutes / 120); // Changes every 2 hours
    const pestProbability = seededRand(pestEventSeed);

    // ~10% chance of pest event during warm daylight hours
    if (pestProbability > 0.9) {
      // Pest infestation: spike tVOC to infection levels
      const pestIntensity = seededRand(pestEventSeed + 1);
      tvoc = 90 + pestIntensity * 80; // 90-170 µg/m³ (triggers infection)
    } else if (pestProbability > 0.7) {
      // Moderate pest activity (approaching threshold)
      tvoc = 60 + (nv(13)) * 40; // 60-100 µg/m³
    }
  }

  const waterTable = Math.round((2.5 + (nv(14) - 0.5) * 1.5) * 100) / 100;

  const hh = Math.floor(simMinutes / 60).toString().padStart(2, '0');
  const mm = Math.floor(simMinutes % 60).toString().padStart(2, '0');
  const ss = Math.floor((simMinutes % 1) * 60).toString().padStart(2, '0');

  // Use current date for consistency
  const currentDate = new Date().toISOString().split('T')[0];

  return {
    timestamp: `${currentDate}T${hh}:${mm}:${ss}.000Z`,
    soil_moisture_m3m3: soilMoisture,
    soil_temperature_c: soilTemp,
    soil_ec_msm: Math.max(0.1, soilEc),
    soil_ph: Math.max(4.5, Math.min(8.5, soilPh)),
    soil_water_tension_kpa: Math.max(5, waterTension),
    air_temperature_c: airTemp,
    relative_humidity_pct: humidity,
    atmospheric_pressure_hpa: pressure,
    ambient_co2_umolmol: co2,
    rainfall_rate_mmh: rainfall,
    tvoc_ugm3: Math.max(10, tvoc),
    water_table_depth_m: Math.max(0.5, waterTable),
    solar_irradiance_wm2: solarIrradiance,
    dew_point_c: dewPoint,
    vpd_kpa: Math.max(0, vpd),
    frost_risk_flag: airTemp < 3 ? 'HIGH' : airTemp < 8 ? 'LOW' : 'NONE',
    node_id: nodeId,
  };
}

export function checkForAlerts(reading: SensorReading): Alert | null {
  const alerts: { type: Alert['type']; message: string; severity: Alert['severity'] }[] = [];

  if (reading.air_temperature_c > 38) {
    alerts.push({ type: 'pest', message: `Extreme heat (${reading.air_temperature_c}°C) — high pest activity risk detected`, severity: 'critical' });
  } else if (reading.air_temperature_c > 35) {
    alerts.push({ type: 'pest', message: `High temperature (${reading.air_temperature_c}°C) — elevated pest risk`, severity: 'high' });
  }

  if (reading.soil_moisture_m3m3 < 0.1) {
    alerts.push({ type: 'drought', message: `Critical soil moisture (${reading.soil_moisture_m3m3} m³/m³) — drought condition`, severity: 'critical' });
  } else if (reading.soil_moisture_m3m3 < 0.15) {
    alerts.push({ type: 'drought', message: `Low soil moisture (${reading.soil_moisture_m3m3} m³/m³) — irrigation needed`, severity: 'high' });
  }

  if (reading.frost_risk_flag === 'HIGH') {
    alerts.push({ type: 'frost', message: `Frost risk! Air temperature ${reading.air_temperature_c}°C`, severity: 'critical' });
  }

  if (reading.tvoc_ugm3 > 400) {
    alerts.push({ type: 'anomaly', message: `High TVOC (${reading.tvoc_ugm3} µg/m³) — possible chemical contamination`, severity: 'high' });
  }

  if (reading.soil_ph < 5.0 || reading.soil_ph > 8.0) {
    alerts.push({ type: 'anomaly', message: `Unusual soil pH (${reading.soil_ph}) — check soil conditions`, severity: 'medium' });
  }

  if (alerts.length === 0) return null;

  const chosen = alerts[Math.floor(Math.random() * alerts.length)];
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    ...chosen,
    node_id: reading.node_id,
    created_at: new Date().toISOString(),
    alert_type: 'infection',
  };
}

/**
 * Generate infection alert for a node that just became infected
 */
export function generateInfectionAlert(
  nodeId: string,
  triggers: Array<{ type: string; message: string; severity: string }>
): Alert {
  // Determine alert type and message based on triggers
  let alertType: Alert['type'] = 'anomaly';
  let message = 'Infection detected';
  let severity: Alert['severity'] = 'critical';

  for (const trigger of triggers) {
    if (trigger.type === 'tvoc_critical') {
      alertType = 'pest';
      message = 'INFECTION: Critical pest contamination detected (tVOC spike)';
      severity = 'critical';
      break;
    } else if (trigger.type === 'low_soil_moisture') {
      alertType = 'drought';
      message = 'INFECTION: Irrigation system failure (extremely low soil moisture)';
      severity = 'critical';
      break;
    } else if (trigger.type === 'low_humidity') {
      alertType = 'drought';
      message = 'INFECTION: Severe drought stress (extremely low humidity)';
      severity = 'critical';
      break;
    }
  }

  return {
    id: crypto.randomUUID(),
    type: alertType,
    message,
    severity,
    node_id: nodeId,
    created_at: new Date().toISOString(),
    alert_type: 'infection',
  };
}

/**
 * Generate warning alert for a node whose neighbor became infected
 */
export function generateNeighborWarningAlert(
  nodeId: string,
  infectedNeighborId: string,
  distance: number,
  triggerType: string
): Alert {
  let alertType: Alert['type'] = 'anomaly';
  let message = 'Neighbor node warning: infection detected nearby';
  let severity: Alert['severity'] = 'high';

  if (triggerType === 'tvoc_critical') {
    alertType = 'pest';
    message = `WARNING: Neighbor node (${infectedNeighborId.substring(0, 8)}...) infected with pest contamination`;
    severity = 'high';
  } else if (triggerType === 'low_soil_moisture') {
    alertType = 'drought';
    message = `WARNING: Neighbor node (${infectedNeighborId.substring(0, 8)}...) has irrigation failure`;
    severity = 'high';
  } else if (triggerType === 'low_humidity') {
    alertType = 'drought';
    message = `WARNING: Neighbor node (${infectedNeighborId.substring(0, 8)}...) experiencing severe drought`;
    severity = 'high';
  }

  return {
    id: crypto.randomUUID(),
    type: alertType,
    message,
    severity,
    node_id: nodeId,
    created_at: new Date().toISOString(),
    alert_type: 'warning',
    source_node_id: infectedNeighborId,
    distance,
  };
}
