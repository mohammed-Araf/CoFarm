'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SensorReading, Alert, checkForAlerts } from '@/lib/simulator';
import AlertsPanel from './components/AlertsPanel';
import NodeDiscoveryPanel from './components/NodeDiscoveryPanel';
import InfiniteCanvas from './components/InfiniteCanvas';
import NodeDetailView from './components/NodeDetailView';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [ownNodes, setOwnNodes] = useState<NodeData[]>([]);
  const [otherNodes, setOtherNodes] = useState<NodeData[]>([]);
  const [sensorReading, setSensorReading] = useState<SensorReading | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const router = useRouter();

  // Simulation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simMinutes, setSimMinutes] = useState(0); // 0–1439 (0:00 to 23:59)
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Database sensor data cache for the selected node
  const [dbSensorData, setDbSensorData] = useState<SensorReading[]>([]);
  const [sensorDataLoading, setSensorDataLoading] = useState(false);

  // Prevent page-level zoom (trackpad pinch)
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', preventZoom, { passive: false });
    return () => document.removeEventListener('wheel', preventZoom);
  }, []);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
    };
    checkAuth();
  }, [router]);

  // Fetch nodes
  useEffect(() => {
    if (!user) return;

    const fetchNodes = async () => {
      // Fetch own nodes
      const { data: myNodes } = await supabase
        .from('nodes')
        .select('*')
        .eq('user_id', user.id);

      if (myNodes && myNodes.length === 0) {
        router.push('/nodes/new');
        return;
      }

      setOwnNodes(myNodes || []);

      // Fetch other nodes (all nodes not owned by user)
      const { data: others } = await supabase
        .from('nodes')
        .select('node_id, latitude, longitude, elevation_m, status, user_id')
        .neq('user_id', user.id);

      setOtherNodes(others || []);
      setLoading(false);
    };

    fetchNodes();
  }, [user, router]);

  // Simulation timer loop
  useEffect(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    if (!isPlaying) return;

    const intervalMs = 1000 / simSpeed;

    simIntervalRef.current = setInterval(() => {
      setSimMinutes((prev) => {
        const next = prev + 1;
        return next >= 1440 ? 0 : next;
      });
    }, intervalMs);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isPlaying, simSpeed]);

  // Fetch sensor_data from DB when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setDbSensorData([]);
      setSensorReading(null);
      return;
    }

    const fetchSensorData = async () => {
      setSensorDataLoading(true);
      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .eq('node_id', selectedNode.node_id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching sensor data:', error);
        setDbSensorData([]);
      } else {
        setDbSensorData((data as SensorReading[]) || []);
      }
      setSensorDataLoading(false);
    };

    fetchSensorData();
  }, [selectedNode]);

  // Map simMinutes to the closest sensor_data row from DB
  useEffect(() => {
    if (!selectedNode || dbSensorData.length === 0) {
      if (!sensorDataLoading) setSensorReading(null);
      return;
    }

    // Find the closest reading by comparing simMinutes to the timestamp's hour:minute
    let bestIdx = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < dbSensorData.length; i++) {
      const ts = new Date(dbSensorData[i].timestamp);
      const rowMinutes = ts.getHours() * 60 + ts.getMinutes();
      const diff = Math.abs(rowMinutes - simMinutes);
      // Also consider wrapping around midnight
      const wrapDiff = 1440 - diff;
      const minDiff = Math.min(diff, wrapDiff);
      if (minDiff < bestDiff) {
        bestDiff = minDiff;
        bestIdx = i;
      }
    }

    const reading = dbSensorData[bestIdx];
    setSensorReading(reading);

    // Generate alerts from reading
    const alert = checkForAlerts(reading);
    if (alert) {
      setAlerts((prev) => {
        const updated = [alert, ...prev];
        return updated.slice(0, 20);
      });
    }
  }, [selectedNode, simMinutes, dbSensorData, sensorDataLoading]);

  const handleNodeClick = (node: NodeData) => {
    // Only allow detail view for own nodes
    if (ownNodes.some((n) => n.node_id === node.node_id)) {
      setSelectedNode(node);
    }
  };

  const handleBackToCanvas = () => {
    setSelectedNode(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setSimSpeed(speed);
  }, []);

  const handleSeek = useCallback((minutes: number) => {
    setSimMinutes(Math.floor(Math.max(0, Math.min(1439, minutes))));
  }, []);

  if (loading) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-green-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-400">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg h-screen overflow-hidden flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            C0Farm
          </h1>
          <span className="text-gray-600 text-xs">|</span>
          <span className="text-gray-500 text-xs">
            {ownNodes.length} node{ownNodes.length !== 1 ? 's' : ''} registered
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/nodes/new')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-400 hover:border-green-500/50 hover:text-green-400 transition-all text-xs cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Node
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className={`text-[10px] font-medium ${isPlaying ? 'text-green-400' : 'text-gray-500'}`}>
              {isPlaying ? 'SIMULATING' : 'PAUSED'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-400 transition-colors text-sm cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content: 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Alerts */}
        <div className="w-72 border-r border-gray-800/80 bg-gray-900/40 backdrop-blur-xl flex-shrink-0 overflow-hidden">
          <AlertsPanel
            alerts={alerts}
            onAddNode={() => router.push('/nodes/new')}
          />
        </div>

        {/* Center Panel: Canvas or Node Detail */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          {!selectedNode ? (
            <div className="h-full p-3">
              <InfiniteCanvas
                ownNodes={ownNodes}
                otherNodes={otherNodes}
                currentUserId={user?.id || ''}
                onNodeClick={handleNodeClick}
              />
            </div>
          ) : (
            <NodeDetailView
              node={selectedNode}
              sensorData={sensorReading}
              currentSimMinute={simMinutes}
              onBackToMap={handleBackToCanvas}
            />
          )}
        </div>

        {/* Right Panel: Node Discovery */}
        <div className="w-80 border-l border-gray-800/80 bg-gray-900/40 backdrop-blur-xl flex-shrink-0 overflow-hidden">
          <NodeDiscoveryPanel
            ownNodes={ownNodes}
            otherNodes={otherNodes}
            onOwnNodeClick={handleNodeClick}
            isPlaying={isPlaying}
            simSpeed={simSpeed}
            simMinutes={simMinutes}
            onTogglePlay={handleTogglePlay}
            onSpeedChange={handleSpeedChange}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
  );
}
