'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

interface NodeDiscoveryPanelProps {
  ownNodes: NodeData[];
  otherNodes: NodeData[];
  onOwnNodeClick: (node: NodeData) => void;
  // Simulation state
  isPlaying: boolean;
  simSpeed: number;
  simMinutes: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (minutes: number) => void;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'infected':
      return {
        color: '#ef4444',
        bg: 'bg-red-500/15',
        border: 'border-red-500/30',
        text: 'text-red-400',
        badge: 'bg-red-500/20 text-red-400',
        glow: 'shadow-red-500/30',
        label: 'Infected',
      };
    case 'offline':
      return {
        color: '#6b7280',
        bg: 'bg-gray-500/10',
        border: 'border-gray-600/30',
        text: 'text-gray-400',
        badge: 'bg-gray-500/20 text-gray-400',
        glow: 'shadow-gray-500/20',
        label: 'Offline',
      };
    default:
      return {
        color: '#22c55e',
        bg: 'bg-green-500/10',
        border: 'border-green-500/30',
        text: 'text-green-400',
        badge: 'bg-green-500/20 text-green-400',
        glow: 'shadow-green-500/30',
        label: 'Online',
      };
  }
}

export default function NodeDiscoveryPanel({
  ownNodes,
  otherNodes,
  onOwnNodeClick,
  isPlaying,
  simSpeed,
  simMinutes,
  onTogglePlay,
  onSpeedChange,
  onSeek,
}: NodeDiscoveryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'others'>('all');

  const allNodes = useMemo(() => {
    const own = ownNodes.map((n) => ({ ...n, _isOwn: true as const }));
    const others = otherNodes.map((n) => ({ ...n, _isOwn: false as const }));
    return [...own, ...others];
  }, [ownNodes, otherNodes]);

  const filteredNodes = useMemo(() => {
    let nodes = allNodes;
    if (activeTab === 'mine') nodes = nodes.filter((n) => n._isOwn);
    if (activeTab === 'others') nodes = nodes.filter((n) => !n._isOwn);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n) => n.node_id.toLowerCase().includes(q));
    }
    return nodes;
  }, [allNodes, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const infected = allNodes.filter((n) => n.status === 'infected').length;
    const offline = allNodes.filter((n) => n.status === 'offline').length;
    const online = allNodes.length - infected - offline;
    return { total: allNodes.length, own: ownNodes.length, others: otherNodes.length, online, infected, offline };
  }, [allNodes, ownNodes, otherNodes]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800/80">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🛰️</span>
          <h2 className="text-sm font-semibold text-white">Node Discovery</h2>
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
            {stats.total}
          </span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1.5 text-center">
            <div className="text-sm font-bold text-green-400">{stats.own}</div>
            <div className="text-[9px] text-green-400/60 uppercase tracking-wider">Yours</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1.5 text-center">
            <div className="text-sm font-bold text-blue-400">{stats.others}</div>
            <div className="text-[9px] text-blue-400/60 uppercase tracking-wider">Others</div>
          </div>
          <div className="bg-gray-500/10 border border-gray-600/20 rounded-lg px-2 py-1.5 text-center">
            <div className="text-sm font-bold text-gray-300">{stats.online}</div>
            <div className="text-[9px] text-gray-400/60 uppercase tracking-wider">Online</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by node ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800/80">
        {[
          { key: 'all' as const, label: 'All', count: stats.total },
          { key: 'mine' as const, label: 'Mine', count: stats.own },
          { key: 'others' as const, label: 'Others', count: stats.others },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'text-green-400 border-b-2 border-green-500 bg-green-500/5'
                : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent'
            }`}
          >
            {tab.label}
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.key ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-10 h-10 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <p className="text-xs">No nodes found</p>
          </div>
        ) : (
          filteredNodes.map((node) => {
            const statusCfg = getStatusConfig(node.status);
            const isOwn = node._isOwn;

            return (
              <button
                key={node.node_id}
                onClick={() => {
                  if (isOwn) onOwnNodeClick(node);
                }}
                disabled={!isOwn}
                className={`w-full text-left rounded-xl p-3 transition-all duration-200 border ${
                  isOwn
                    ? `${statusCfg.bg} ${statusCfg.border} hover:scale-[1.01] hover:shadow-lg ${statusCfg.glow} cursor-pointer`
                    : 'bg-blue-500/5 border-blue-500/15 opacity-70 cursor-default'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Status dot */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      node.status === 'infected'
                        ? 'bg-red-500 shadow-lg shadow-red-500/50'
                        : node.status === 'offline'
                        ? 'bg-gray-500'
                        : isOwn
                        ? 'bg-green-500 shadow-lg shadow-green-500/50 animate-pulse'
                        : 'bg-blue-500 shadow-lg shadow-blue-500/50'
                    }`}
                  />

                  {/* Node info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-white truncate">
                        {node.node_id.substring(0, 12)}...
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${statusCfg.badge}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {isOwn ? (
                        <span className="text-[10px] text-gray-500">
                          {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-blue-400/50 italic">Discovery only</span>
                      )}
                    </div>
                  </div>

                  {/* Action indicator */}
                  {isOwn ? (
                    <svg className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-blue-500/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Bottom: Simulation Controller */}
      <div className="p-3 border-t border-gray-800/80 space-y-2.5">
        {/* Timer Display */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">SIM</span>
          <div className="font-mono text-2xl font-bold text-white tracking-wider flex items-baseline gap-1">
            <span className="text-xs text-gray-500 font-medium">H</span>
            <span>{Math.floor(simMinutes / 60)}</span>
            <span className={`${isPlaying ? 'animate-pulse' : ''} text-green-400 mx-0.5`}>:</span>
            <span className="text-xs text-gray-500 font-medium">M</span>
            <span>{Math.floor(simMinutes % 60)}</span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            isPlaying
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-700/50 text-gray-500'
          }`}>
            {isPlaying ? 'LIVE' : 'PAUSED'}
          </span>
        </div>

        {/* Progress Bar */}
        <div
          className="relative h-1.5 bg-gray-800 rounded-full cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeek(pct * 1439);
          }}
        >
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${(simMinutes / 1439) * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${(simMinutes / 1439) * 100}% - 6px)` }}
          />
        </div>

        {/* Time markers */}
        <div className="flex justify-between text-[9px] text-gray-600 -mt-1">
          <span>H 0 : M 0</span>
          <span>H 6 : M 0</span>
          <span>H 12 : M 0</span>
          <span>H 18 : M 0</span>
          <span>H 23 : M 59</span>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          {/* Play/Pause */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer ${
              isPlaying
                ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 shadow-lg shadow-green-500/20'
                : 'bg-gray-800/80 border border-gray-600/50 text-gray-300 hover:border-green-500/50 hover:text-green-400'
            }`}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Speed Control — single cycle button */}
          <button
            onClick={() => {
              const speeds = [1, 2, 4, 8, 16];
              const idx = speeds.indexOf(simSpeed);
              onSpeedChange(speeds[(idx + 1) % speeds.length]);
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30 transition-all cursor-pointer min-w-[56px] text-center"
          >
            {simSpeed}X
          </button>

          {/* Reset button */}
          <button
            onClick={() => onSeek(0)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800/60 border border-gray-700/30 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all cursor-pointer"
            title="Reset to 00:00"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
