import { useState, useEffect } from 'react';
import { SensorReading, Alert } from '@/lib/simulator';
import { CriticalAlert } from '@/lib/alertEngine';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

interface FarmerDashboardProps {
  ownNodes: NodeData[];
  alerts: Alert[];
  sensorReading: SensorReading | null;
}

export default function FarmerDashboard({
  ownNodes,
  alerts,
  sensorReading,
}: FarmerDashboardProps) {
  const [advice, setAdvice] = useState<string>('');
  const [loadingAdvice, setLoadingAdvice] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Derive simple metrics
  const hasAlerts = alerts.length > 0;
  
  let overallStatus = 'All Good';
  let statusColor = 'text-green-400';
  let bgColor = 'bg-green-500/10 border-green-500/20';
  let icon = '🌱';

  if (hasAlerts) {
    overallStatus = 'Needs Review';
    statusColor = 'text-yellow-400';
    bgColor = 'bg-yellow-500/10 border-yellow-500/20';
    icon = '⚠️';
  }

  // Fetch advice from Gemini API
  useEffect(() => {
    let isMounted = true;
    const fetchAdvice = async () => {
      if (ownNodes.length === 0) {
        if (isMounted) {
          setLoadingAdvice(false);
          setAdvice("You don't have any sensors set up yet. Add some sensors to get started!");
        }
        return;
      }

      try {
        setLoadingAdvice(true);
        setError(null);
        
        const response = await fetch('/api/farmer-advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeCount: ownNodes.length,
            activeAlertsCount: alerts.length,
            activeAlertDetails: alerts.map(a => a.message),
            temperature: sensorReading?.air_temperature_c,
            moisture: sensorReading ? Math.round(sensorReading.soil_moisture_m3m3 * 100) : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate AI advice');
        }

        const data = await response.json();
        if (isMounted) {
          setAdvice(data.summary);
        }
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setError("Sorry, I couldn't get the latest AI advice right now. Please check your connection or AI service.");
        }
      } finally {
        if (isMounted) {
          setLoadingAdvice(false);
        }
      }
    };

    // Debounce to avoid flooding the API if data changes rapidly (e.g. during fast simulation)
    const timeoutId = setTimeout(() => {
      fetchAdvice();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [ownNodes.length, alerts.length, sensorReading?.air_temperature_c, sensorReading?.soil_moisture_m3m3]);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Header Greeting */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Hello, Farmer! 👋</h2>
          <p className="text-gray-400 text-lg">Here's a simple overview of how your farm is doing right now.</p>
        </div>

        {/* Big Status Card */}
        <div className={`p-8 rounded-2xl border ${bgColor} flex flex-col items-center justify-center text-center transition-colors duration-500`}>
          <div className="text-6xl mb-4">{icon}</div>
          <h3 className={`text-4xl font-bold mb-2 ${statusColor}`}>{overallStatus}</h3>
          <p className="text-gray-300 text-lg">
            {ownNodes.length} active sensors monitoring your land.
            {alerts.length > 0 && ` There are ${alerts.length} issues that need you right away!`}
          </p>
        </div>

        {/* AI Assistant Card */}
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-6 relative overflow-hidden">
          {/* Decorative AI Glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-white mb-2">Farm Assistant Advisor</h4>
              
              <div className="min-h-[80px] flex items-center">
                {loadingAdvice && !advice ? (
                  <div className="flex items-center gap-3 text-purple-400 text-sm">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Thinking about your farm...
                  </div>
                ) : error ? (
                  <p className="text-red-400">{error}</p>
                ) : (
                  <div className="prose prose-invert">
                    <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">{advice}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Simplified Sensor Readings (if available) */}
        {sensorReading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-6 flex flex-col justify-center">
              <span className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-1">Latest Average Temp</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{sensorReading.air_temperature_c.toFixed(1)}</span>
                <span className="text-gray-400 text-lg">°C</span>
              </div>
            </div>
            
            <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-6 flex flex-col justify-center">
              <span className="text-gray-500 text-sm uppercase tracking-wider font-semibold mb-1">Latest Soil Moisture</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{Math.round(sensorReading.soil_moisture_m3m3 * 100).toFixed(0)}</span>
                <span className="text-gray-400 text-lg">%</span>
              </div>
              {(sensorReading.soil_moisture_m3m3 * 100) < 30 && (
                <span className="text-red-400 text-sm mt-2">Looks a bit dry!</span>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
