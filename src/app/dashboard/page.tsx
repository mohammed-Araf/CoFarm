'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SensorReading, Alert, checkForAlerts, generateTimeBasedReading } from '@/lib/simulator';
import {
  CriticalAlert,
  InterClusterAlert,
  AlertLine,
  CriticalAlertType,
  evaluateCriticalAlert,
  findNodesWithFallback,
  deduplicateClusterAlerts,
  getTestOverrideReading,
  buildAlertLines,
  NodeData as AlertNodeData,
} from '@/lib/alertEngine';
import AlertsPanel from './components/AlertsPanel';
import NodeDiscoveryPanel from './components/NodeDiscoveryPanel';
import InfiniteCanvas from './components/InfiniteCanvas';
import NodeDetailView from './components/NodeDetailView';
import FarmerDashboard from './components/FarmerDashboard';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<'normal' | 'farmer'>('normal');
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

  // ── Critical Alert System ──────────────────────────────────────
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [interClusterAlerts, setInterClusterAlerts] = useState<InterClusterAlert[]>([]);
  const [alertLines, setAlertLines] = useState<AlertLine[]>([]);
  const [testTriggerType, setTestTriggerType] = useState<CriticalAlertType | null>(null);
  const [testTargetNodeId, setTestTargetNodeId] = useState<string | null>(null);

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

  // ── Critical Alert Evaluation ────────────────────────────────
  // When test trigger is active: evaluate locally + write to Supabase `alerts` table.
  // Also subscribe to Supabase Realtime to receive alerts from OTHER users.

  // Write to Supabase when local test trigger fires
  useEffect(() => {
    if (ownNodes.length === 0 || !user) return;

    if (!testTriggerType) {
      // Clear local alerts
      setCriticalAlerts((prev) => prev.filter(a => a.sourceClusterId !== user.id));
      setInterClusterAlerts((prev) => prev.filter(a => a.sourceClusterId !== user.id));
      // Mark our critical alerts as inactive (triggers UPDATE event for receivers)
      supabase
        .from('alerts')
        .update({ is_active: false })
        .eq('source_cluster_id', user.id)
        .eq('is_critical', true)
        .eq('is_active', true)
        .then(() => {});
      return;
    }

    const allNodes = [...ownNodes, ...otherNodes];
    const testNode = ownNodes.find(n => n.node_id === testTargetNodeId) || ownNodes[0];
    const baseReading = generateTimeBasedReading(testNode.node_id, simMinutes);
    const reading = getTestOverrideReading(testTriggerType, baseReading);

    const critical = evaluateCriticalAlert(reading, testNode as AlertNodeData);
    if (critical) {
      // Update local state
      setCriticalAlerts((prev) => {
        const filtered = prev.filter(a => a.sourceClusterId !== user.id);
        return [...filtered, critical];
      });

      // Sender: only show red node glow, don't compute connection lines
      // (connection lines are only for the receiver side)

      // Persist to Supabase alerts table
      // First deactivate any existing, then insert new
      supabase
        .from('alerts')
        .update({ is_active: false })
        .eq('source_cluster_id', critical.sourceClusterId)
        .eq('is_critical', true)
        .then(() => {
          supabase
            .from('alerts')
            .insert({
              node_id: critical.sourceNodeId,
              source_cluster_id: critical.sourceClusterId,
              type: critical.type,
              severity: 'critical',
              message: critical.message,
              is_critical: true,
              radius_meters: 100,
              is_active: true,
            })
            .then(({ error }) => {
              if (error) console.error('Error writing critical alert:', error);
            });
        });
    }
  }, [ownNodes, otherNodes, simMinutes, testTriggerType, testTargetNodeId, user]);

  // Subscribe to Supabase Realtime for critical alerts from OTHER users
  useEffect(() => {
    if (!user || ownNodes.length === 0) return;

    const allNodes = [...ownNodes, ...otherNodes];

    // Fetch existing active critical alerts on mount
    const fetchExisting = async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('is_critical', true)
        .eq('is_active', true)
        .neq('source_cluster_id', user.id);

      if (error) {
        console.error('Error fetching critical alerts:', error);
        return;
      }

      if (data && data.length > 0) {
        const remoteCriticals: CriticalAlert[] = [];
        const remoteInterCluster: InterClusterAlert[] = [];

        for (const row of data) {
          const sourceNode = allNodes.find(n => n.node_id === row.node_id);
          if (!sourceNode) continue;

          const ca: CriticalAlert = {
            id: row.id,
            sourceNodeId: row.node_id,
            sourceClusterId: row.source_cluster_id,
            type: row.type,
            message: row.message || '',
            timestamp: row.created_at,
            lat: sourceNode.latitude,
            lng: sourceNode.longitude,
          };
          remoteCriticals.push(ca);

          const nearby = findNodesWithFallback(sourceNode as AlertNodeData, allNodes as AlertNodeData[]);
          const deduped = deduplicateClusterAlerts(ca, nearby as AlertNodeData[]);
          remoteInterCluster.push(...deduped);
        }

        setCriticalAlerts(prev => {
          const local = prev.filter(a => a.sourceClusterId === user.id);
          return [...local, ...remoteCriticals];
        });
        setInterClusterAlerts(prev => {
          const local = prev.filter(a => a.sourceClusterId === user.id);
          return [...local, ...remoteInterCluster];
        });
      }
    };

    fetchExisting();

    // Subscribe to real-time changes on the alerts table (critical only)
    const channel = supabase
      .channel('critical-alerts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: 'is_critical=eq.true' },
        (payload) => {
          const row = payload.new as Record<string, string | number | boolean>;
          if (row.source_cluster_id === user.id) return;

          const sourceNode = allNodes.find(n => n.node_id === row.node_id);
          if (!sourceNode) return;

          const ca: CriticalAlert = {
            id: row.id as string,
            sourceNodeId: row.node_id as string,
            sourceClusterId: row.source_cluster_id as string,
            type: row.type as CriticalAlertType,
            message: (row.message || '') as string,
            timestamp: (row.created_at || new Date().toISOString()) as string,
            lat: sourceNode.latitude,
            lng: sourceNode.longitude,
          };

          setCriticalAlerts(prev => [...prev.filter(a => a.id !== ca.id), ca]);

          const nearby = findNodesWithFallback(sourceNode as AlertNodeData, allNodes as AlertNodeData[]);
          const deduped = deduplicateClusterAlerts(ca, nearby as AlertNodeData[]);
          setInterClusterAlerts(prev => {
            const filtered = prev.filter(a => a.sourceClusterId !== ca.sourceClusterId);
            return [...filtered, ...deduped];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts', filter: 'is_critical=eq.true' },
        (payload) => {
          const row = payload.new as Record<string, string | number | boolean>;
          if (row.source_cluster_id === user.id) return;

          // If alert was deactivated, remove from state
          if (row.is_active === false) {
            setCriticalAlerts(prev => prev.filter(a =>
              a.sourceClusterId !== (row.source_cluster_id as string)
            ));
            setInterClusterAlerts(prev => prev.filter(a =>
              a.sourceClusterId !== (row.source_cluster_id as string)
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, ownNodes, otherNodes]);

  // Rebuild alert lines whenever critical/inter-cluster alerts change
  useEffect(() => {
    setAlertLines(buildAlertLines(criticalAlerts, interClusterAlerts));
  }, [criticalAlerts, interClusterAlerts]);

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

  const handleTestTrigger = useCallback((type: CriticalAlertType) => {
    setTestTriggerType(type);
  }, []);

  const handleClearTestTrigger = useCallback(() => {
    setTestTriggerType(null);
  }, []);

  const handleTestNodeChange = useCallback((nodeId: string) => {
    setTestTargetNodeId(nodeId);
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
          {criticalAlerts.length > 0 && (
            <>
              <span className="text-gray-600 text-xs">|</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-full animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                  {criticalAlerts.length} Critical Alert{criticalAlerts.length !== 1 ? 's' : ''}
                </span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-800/60 p-1 rounded-lg border border-gray-700/50">
            <button
              onClick={() => setViewMode('normal')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'normal' 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Normal
            </button>
            <button
              onClick={() => setViewMode('farmer')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'farmer' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Farmer
            </button>
          </div>

          <button
            onClick={() => router.push('/magic-stick')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-400 hover:border-purple-500/50 hover:text-purple-400 transition-all text-xs cursor-pointer"
          >
            <span className="text-sm">🪄</span>
            Magic Stick
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-400 hover:border-orange-500/50 hover:text-orange-400 transition-all text-xs cursor-pointer"
          >
            <span className="text-sm">⚙️</span>
            Settings
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
      {viewMode === 'farmer' ? (
        <div className="flex-1 overflow-hidden bg-gray-900/40 backdrop-blur-xl">
          <FarmerDashboard 
            ownNodes={ownNodes}
            alerts={alerts}
            criticalAlerts={criticalAlerts}
            sensorReading={sensorReading}
          />
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Alerts */}
        <div className="w-72 border-r border-gray-800/80 bg-gray-900/40 backdrop-blur-xl flex-shrink-0 overflow-hidden">
          <AlertsPanel
            alerts={alerts}
            interClusterAlerts={interClusterAlerts}
            criticalAlerts={criticalAlerts}
            ownNodes={ownNodes}
            testTargetNodeId={testTargetNodeId || (ownNodes[0]?.node_id ?? '')}
            userId={user?.id || ''}
            onAddNode={() => router.push('/nodes/new')}
            onTestTrigger={handleTestTrigger}
            onClearTestTrigger={handleClearTestTrigger}
            onTestNodeChange={handleTestNodeChange}
            isTestActive={testTriggerType !== null}
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
                criticalAlerts={criticalAlerts}
                alertLines={alertLines}
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
      )}
    </div>
  );
}
