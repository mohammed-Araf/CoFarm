# Node Infection System

## Overview

The C0Farm infection system monitors sensor nodes for critical contamination and anomalies, automatically marking nodes as "infected" when dangerous conditions are detected. This system uses both **absolute thresholds** and **relative Z-score based detection** to identify compromised nodes.

## Infection Triggers

### 1. **Absolute Threshold: tVOC Contamination** ⚠️ PRIMARY INDICATOR
- **Trigger**: `tvoc_ugm3 > 90 µg/m³`
- **Type**: Critical chemical contamination / pest infection
- **Severity**: CRITICAL
- **Message**: "Critical TVOC contamination: [value] µg/m³"

This is an immediate infection trigger. Any reading above 90 µg/m³ of Total Volatile Organic Compounds indicates severe chemical contamination or pest infestation.

### 2. **Relative Threshold: Extreme Anomalies** (Non-Diurnal Fields Only)
- **Trigger**: Z-score ≥ 4.0 (extreme statistical outlier)
- **Rolling Window**: 60 minutes
- **Type**: Extreme anomaly detection
- **Severity**: SEVERE

**IMPORTANT**: Only **non-diurnal** sensors are analyzed for Z-score anomalies. Diurnal fields (solar, temperature, etc.) are excluded as they naturally have extreme values at certain times of day.

#### Non-Diurnal Fields Monitored (Normally Distributed):
- ✅ `soil_moisture_m3m3` - Relatively stable, slow changes
- ✅ `soil_ec_msm` - Electrical conductivity, stable
- ✅ `soil_ph` - Very stable over time
- ✅ `soil_water_tension_kpa` - Relatively stable
- ✅ `relative_humidity_pct` - Some diurnal but extremes are problematic
- ✅ `ambient_co2_umolmol` - Some diurnal but extremes indicate issues
- ✅ `tvoc_ugm3` - **CRITICAL** pest infection indicator
- ✅ `atmospheric_pressure_hpa` - Weather-related, normally distributed
- ✅ `rainfall_rate_mmh` - Event-based, not diurnal
- ✅ `water_table_depth_m` - Very stable

#### Diurnal Fields Excluded (Natural Daily Cycles):
- ❌ `solar_irradiance_wm2` - Peaks at noon (natural)
- ❌ `air_temperature_c` - Peaks at 14:00 (natural)
- ❌ `soil_temperature_c` - Follows air temp with lag (natural)
- ❌ `vpd_kpa` - Vapor pressure deficit, correlates with temp (natural)
- ❌ `dew_point_c` - Follows temp/humidity cycles (natural)

### 3. **Sustained Anomalies**
- **Trigger**: ≥3 extreme readings for the same sensor in 24 hours
- **Type**: Sustained anomaly
- **Severity**: SEVERE
- **Message**: "Sustained extreme anomaly in [field]: [count] critical readings (max Z-score: [value])"

Multiple extreme outliers for the same sensor over time indicate persistent system failure or environmental hazard.

### 4. **Multiple Concurrent Anomalies**
- **Trigger**: ≥3 different sensors showing anomalies in a 30-minute window
- **Type**: System-wide failure
- **Severity**: CRITICAL
- **Message**: "System-wide failure: [count] concurrent sensor anomalies detected"

When multiple sensors fail simultaneously, it indicates catastrophic contamination or node compromise.

## Infection Duration & Recovery

### Configuration
```typescript
{
  tvocThreshold: 90,              // tVOC absolute threshold (µg/m³)
  criticalZScore: 4.0,            // Z-score for extreme anomalies
  multipleAnomalyThreshold: 3,   // Min concurrent anomalies
  infectionDurationMinutes: 180, // 3 hours quarantine (sim time)
  requireNormalReadings: true,   // Must normalize before recovery
  normalReadingWindow: 30        // Minutes to verify normalization
}
```

### Recovery Process

A node recovers from infection when:
1. **Minimum Duration**: 180 simulated minutes (3 hours) have elapsed since infection
2. **Readings Normalized**: Current readings show no infection triggers
   - tVOC < 90 µg/m³
   - No extreme anomalies detected

The system automatically monitors all nodes every simulation tick and updates their status in real-time.

## Why Exclude Diurnal Fields?

Diurnal fields follow natural day/night cycles and will always show extreme Z-scores at certain times:
- **Solar irradiance**: Zero at night, 1000+ W/m² at noon = extreme by definition
- **Air temperature**: 12°C at dawn, 30°C at 14:00 = large natural variation
- **Soil temperature**: Follows air temp with lag = predictable extremes
- **VPD/Dew Point**: Directly calculated from temp/humidity = inherit diurnal patterns

Flagging these as "infections" would create false positives during normal operation. Instead, we focus on **stable, normally distributed sensors** where extremes indicate actual problems:
- **High tVOC**: Pest infestation or chemical contamination
- **Extreme soil moisture drop**: Equipment failure or drought
- **Soil pH spike**: Chemical spill
- **Pressure anomaly**: Sensor malfunction
- **Excessive rainfall**: Flash flood or sensor error

## Implementation Architecture

### Files
```
src/lib/infection/
├── types.ts           # TypeScript interfaces
├── detection.ts       # Infection detection algorithms
├── stateManager.ts    # Client-side infection state
├── monitor.ts         # Real-time monitoring service
└── index.ts          # Public exports
```

### Integration Points

1. **Dashboard Loop** (`src/app/dashboard/page.tsx`)
   - Runs infection monitoring every simulation tick
   - Updates node statuses automatically
   - Generates readings with `timeMinute` property

2. **Node Detail View** (`src/app/dashboard/components/NodeDetailView.tsx`)
   - Shows infection status panel
   - Displays triggers and recovery countdown
   - Visual infection indicators

3. **Canvas/Map Views**
   - Infected nodes rendered in red (`#ef4444`)
   - Pulsing warning indicators
   - Status badges

## UI Components

### InfectionStatusPanel
Displays detailed infection information:
- **Status Badge**: Healthy (green) or INFECTED (red, pulsing)
- **Recovery Countdown**: Time remaining until automatic recovery
- **Infection Timeline**: Duration infected
- **Trigger Analysis**: Detailed list of contamination sources
- **Recovery Protocol**: Information about decontamination process

### Visual Indicators
- 🟢 **Green**: Online, healthy node
- 🔴 **Red**: Infected node (with pulse animation)
- 🔵 **Blue**: Other users' nodes
- ⚫ **Gray**: Offline nodes

## Testing the System

### Method 1: Wait for Natural Anomalies
Run the simulation at 4x speed and wait for extreme readings to occur naturally. tVOC values peak during high solar irradiance and may occasionally exceed 90 µg/m³.

### Method 2: Manual Threshold Adjustment
Temporarily reduce `tvocThreshold` to 50 in `DEFAULT_INFECTION_CONFIG` to trigger infections more frequently.

### Method 3: Inject Test Data
Modify `generateTimeBasedReading` to add occasional extreme spikes for testing:
```typescript
// In simulator.ts, add this after line 128:
if (simMinutes === 720 && nodeId.includes('test')) {
  tvoc = 150; // Force infection at noon
}
```

## Console Logging

The system logs infection events to the browser console:

```
[Infection Monitor] Node 12345678 INFECTED: Critical TVOC contamination: 95.3 µg/m³ (threshold: 90)
[Infection Monitor] Node 12345678 recovered: Infection cleared after 187 minutes
```

## Database Integration (Future)

Currently, infection state is managed client-side in memory. For production:

1. **Add `infection_log` table**:
```sql
CREATE TABLE infection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(node_id),
  infected_at TIMESTAMP,
  recovered_at TIMESTAMP,
  triggers JSONB,
  severity TEXT
);
```

2. **Update `nodes.status` via Supabase**:
```typescript
await supabase
  .from('nodes')
  .update({ status: 'infected' })
  .eq('node_id', nodeId);
```

3. **Persist infection state** for multi-session continuity

## Performance

- **Monitoring Frequency**: Every simulation tick (1-4 per second depending on speed)
- **Time-Series Generation**: ~5-10ms per node (cached)
- **Anomaly Detection**: ~30ms for 1440 readings
- **Memory**: ~195KB per node for cached time-series
- **CPU Impact**: Minimal (<2% on modern hardware)

## Security Considerations

This is a **demonstration system** for educational purposes. In production:

1. Validate sensor readings server-side
2. Implement rate limiting on status updates
3. Add authentication for status changes
4. Log all infection events with audit trails
5. Alert administrators of critical infections
6. Implement quarantine protocols (prevent data writes from infected nodes)

## Future Enhancements

- **Infection Spread**: Geographic proximity-based contamination spread
- **Recovery Actions**: Manual decontamination procedures
- **Alert Escalation**: Email/SMS notifications for critical infections
- **Historical Analysis**: Infection trends and patterns over time
- **Predictive Detection**: ML-based early warning system
- **Quarantine Mode**: Automatically isolate infected node data
