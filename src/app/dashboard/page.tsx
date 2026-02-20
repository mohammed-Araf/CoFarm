'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SensorReading, Alert, checkForAlerts, generateTimeBasedReading, generateInfectionAlert, generateNeighborWarningAlert } from '@/lib/simulator';
import { monitorNodeInfection, infectionStateManager } from '@/lib/infection';
import { calculateDistanceMatrix } from '@/lib/distance';
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

  // Global sensor data cache for ALL nodes
  const [allNodesData, setAllNodesData] = useState<Map<string, SensorReading[]>>(new Map());
  const [dataLoadingProgress, setDataLoadingProgress] = useState<number>(0);

  // Distance matrix and reference point
  const { refLat, refLng, distanceMatrix } = useMemo(() => {
    if (ownNodes.length === 0) {
      return { refLat: 0, refLng: 0, distanceMatrix: new Map() };
    }

    // Calculate reference point (mean of own nodes)
    const sumLat = ownNodes.reduce((sum, n) => sum + n.latitude, 0);
    const sumLng = ownNodes.reduce((sum, n) => sum + n.longitude, 0);
    const refLat = sumLat / ownNodes.length;
    const refLng = sumLng / ownNodes.length;

    // Calculate distance matrix for all nodes
    const allNodes = [...ownNodes, ...otherNodes];
    const distanceMatrix = calculateDistanceMatrix(
      allNodes.map(n => ({
        node_id: n.node_id,
        latitude: n.latitude,
        longitude: n.longitude,
      })),
      refLat,
      refLng
    );

    return { refLat, refLng, distanceMatrix };
  }, [ownNodes, otherNodes]);

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

  // Fetch sensor data for ALL nodes (own + others) on dashboard load
  useEffect(() => {
    if (!user || ownNodes.length === 0) return;

    const fetchAllNodesSensorData = async () => {
      const allNodes = [...ownNodes, ...otherNodes];
      const dataMap = new Map<string, SensorReading[]>();

      console.log(`[Global Data Fetch] Loading sensor data for ${allNodes.length} nodes...`);

      // Fetch in parallel batches of 10 to avoid overwhelming the connection
      const batchSize = 10;
      for (let i = 0; i < allNodes.length; i += batchSize) {
        const batch = allNodes.slice(i, i + batchSize);
        const promises = batch.map(node =>
          supabase
            .from('sensor_data')
            .select('*')
            .eq('node_id', node.node_id)
            .order('timestamp', { ascending: true })
            .range(0, 1439)
        );

        const results = await Promise.all(promises);
        results.forEach((result, idx) => {
          if (result.data) {
            dataMap.set(batch[idx].node_id, result.data as SensorReading[]);
            console.log(`[Global Data Fetch] Loaded ${result.data.length} readings for node ${batch[idx].node_id}`);
          }
        });

        setDataLoadingProgress(Math.min(100, ((i + batchSize) / allNodes.length) * 100));
      }

      setAllNodesData(dataMap);
      console.log(`[Global Data Fetch] Complete! Cached data for ${dataMap.size} nodes`);
    };

    fetchAllNodesSensorData();
  }, [user, ownNodes, otherNodes]);

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
        .order('timestamp', { ascending: true })
        .range(0, 1439); // Explicitly request rows 0-1439 (1440 total rows)

      if (error) {
        console.error('Error fetching sensor data:', error);
        setDbSensorData([]);
      } else {
        console.log(`[Data Fetch] Retrieved ${data?.length || 0} rows from database`);
        setDbSensorData((data as SensorReading[]) || []);
      }
      setSensorDataLoading(false);
    };

    fetchSensorData();
  }, [selectedNode]);

  // Global infection monitoring - check ALL nodes at current simMinutes
  useEffect(() => {
    if (allNodesData.size === 0 || distanceMatrix.size === 0) return;

    const allNodes = [...ownNodes, ...otherNodes];
    const updates: { nodeId: string; newStatus: string }[] = [];
    const newAlerts: Alert[] = [];

    // Generate current simulation timestamp
    const hh = Math.floor(simMinutes / 60).toString().padStart(2, '0');
    const mm = Math.floor(simMinutes % 60).toString().padStart(2, '0');
    const currentDate = new Date().toISOString().split('T')[0];
    const currentSimTime = `${currentDate}T${hh}:${mm}:00.000Z`;

    // First pass: Check each node for infection
    const infectedNodes = new Set<string>();
    const newlyInfectedNodes = new Map<string, any>(); // nodeId -> triggers

    for (const node of allNodes) {
      const nodeData = allNodesData.get(node.node_id);
      if (!nodeData || nodeData.length === 0) continue;

      // Find reading at simMinutes (same matching logic as selected node)
      let bestIdx = 0;
      let bestDiff = Infinity;

      for (let i = 0; i < nodeData.length; i++) {
        const ts = new Date(nodeData[i].timestamp);
        const rowMinutes = ts.getUTCHours() * 60 + ts.getUTCMinutes();
        const diff = Math.abs(rowMinutes - simMinutes);
        const wrapDiff = 1440 - diff;
        const minDiff = Math.min(diff, wrapDiff);
        if (minDiff < bestDiff) {
          bestDiff = minDiff;
          bestIdx = i;
        }
      }

      const reading = {
        ...nodeData[bestIdx],
        timeMinute: simMinutes,
      };

      // Monitor infection for this node
      const wasInfected = node.status === 'infected';
      const newStatus = monitorNodeInfection(node.node_id, reading, currentSimTime);
      const isNowInfected = newStatus === 'infected';

      if (isNowInfected) {
        infectedNodes.add(node.node_id);

        // Track newly infected nodes (just became infected)
        if (!wasInfected) {
          const infectionState = infectionStateManager.getState(node.node_id);
          newlyInfectedNodes.set(node.node_id, infectionState.triggers);

          // Generate infection alert for this node
          const infectionAlert = generateInfectionAlert(node.node_id, infectionState.triggers);
          newAlerts.push(infectionAlert);
        }
      }

      if (newStatus !== node.status) {
        updates.push({ nodeId: node.node_id, newStatus });
      }
    }

    // Second pass: Check for at-risk nodes (nearest neighbor is infected)
    for (const node of allNodes) {
      // Skip if already infected
      if (infectedNodes.has(node.node_id)) continue;

      // Get distances to all other nodes
      const distances = distanceMatrix.get(node.node_id);
      if (!distances) continue;

      // Find nearest neighbor
      let nearestDistance = Infinity;
      let nearestNodeId = '';
      distances.forEach((distance: number, otherNodeId: string) => {
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestNodeId = otherNodeId;
        }
      });

      // Check if nearest neighbor is infected
      const nearestIsInfected = infectedNodes.has(nearestNodeId);
      const nearestJustBecameInfected = newlyInfectedNodes.has(nearestNodeId);
      const currentlyAtRisk = node.status === 'at_risk';

      if (nearestIsInfected && !currentlyAtRisk) {
        // Set to at_risk
        infectionStateManager.setAtRisk(node.node_id, nearestNodeId, nearestDistance);
        updates.push({ nodeId: node.node_id, newStatus: 'at_risk' });

        // Generate warning alert if the neighbor just became infected
        if (nearestJustBecameInfected) {
          const triggers = newlyInfectedNodes.get(nearestNodeId);
          const primaryTriggerType = triggers && triggers.length > 0 ? triggers[0].type : 'anomaly';
          const warningAlert = generateNeighborWarningAlert(
            node.node_id,
            nearestNodeId,
            nearestDistance,
            primaryTriggerType
          );
          newAlerts.push(warningAlert);
        }
      } else if (!nearestIsInfected && currentlyAtRisk) {
        // Clear at_risk status
        infectionStateManager.setOnline(node.node_id);
        updates.push({ nodeId: node.node_id, newStatus: 'online' });
      }
    }

    // Batch update all nodes that changed status
    if (updates.length > 0) {
      setOwnNodes(prev =>
        prev.map(node => {
          const update = updates.find(u => u.nodeId === node.node_id);
          return update ? { ...node, status: update.newStatus } : node;
        })
      );

      setOtherNodes(prev =>
        prev.map(node => {
          const update = updates.find(u => u.nodeId === node.node_id);
          return update ? { ...node, status: update.newStatus } : node;
        })
      );

      // Update selectedNode if it changed
      if (selectedNode) {
        const selectedUpdate = updates.find(u => u.nodeId === selectedNode.node_id);
        if (selectedUpdate) {
          setSelectedNode(prev => prev ? { ...prev, status: selectedUpdate.newStatus } : prev);
        }
      }
    }

    // Add new alerts to the alerts feed
    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const updated = [...newAlerts, ...prev];
        return updated.slice(0, 50); // Keep last 50 alerts
      });
    }
  }, [simMinutes, allNodesData, ownNodes, otherNodes, selectedNode, distanceMatrix]);

  // Map simMinutes to the closest sensor_data row from DB
  useEffect(() => {
    if (!selectedNode || dbSensorData.length === 0) {
      if (!sensorDataLoading) setSensorReading(null);
      return;
    }

    console.log(`[Timestamp Sync] simMinutes: ${simMinutes}, dbSensorData count: ${dbSensorData.length}`);

    // Find the closest reading by comparing simMinutes to the timestamp's hour:minute
    let bestIdx = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < dbSensorData.length; i++) {
      const ts = new Date(dbSensorData[i].timestamp);
      const rowMinutes = ts.getUTCHours() * 60 + ts.getUTCMinutes();
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
    const matchedTs = new Date(reading.timestamp);
    const matchedMinutes = matchedTs.getUTCHours() * 60 + matchedTs.getUTCMinutes();
    console.log(`[Timestamp Sync] Matched index ${bestIdx}: sim=${simMinutes}min (${Math.floor(simMinutes/60)}:${simMinutes%60}), db=${matchedMinutes}min (${matchedTs.getUTCHours()}:${matchedTs.getUTCMinutes()}), diff=${bestDiff}min`);
    console.log(`[Timestamp Sync] Reading tVOC: ${reading.tvoc_ugm3}, timestamp: ${reading.timestamp}`);

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

  if (loading || dataLoadingProgress < 100) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-green-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-400">
            {loading ? 'Loading dashboard...' : 'Loading network sensor data...'}
          </span>
          {dataLoadingProgress > 0 && dataLoadingProgress < 100 && (
            <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${dataLoadingProgress}%` }}
              />
            </div>
          )}
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
              dbSensorData={dbSensorData}
              onBackToMap={handleBackToCanvas}
              distanceMatrix={distanceMatrix}
              allNodes={[...ownNodes, ...otherNodes]}
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
