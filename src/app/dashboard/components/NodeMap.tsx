'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

interface NodeMapProps {
  ownNodes: NodeData[];
  otherNodes: NodeData[];
  currentUserId: string;
  onNodeClick: (node: NodeData) => void;
}

const statusColors: Record<string, string> = {
  own_online: '#22c55e',   // green
  own_offline: '#6b7280',  // gray
  own_infected: '#ef4444', // red
  other_online: '#3b82f6', // blue
  other_offline: '#6b7280',
  other_infected: '#ef4444',
};

function getNodeColor(node: NodeData, isOwn: boolean): string {
  if (node.status === 'infected') return statusColors.own_infected;
  if (node.status === 'offline') return statusColors.own_offline;
  return isOwn ? statusColors.own_online : statusColors.other_online;
}

function MapAutoCenter({ nodes }: { nodes: NodeData[] }) {
  const map = useMap();

  useEffect(() => {
    if (nodes.length > 0) {
      const lats = nodes.map(n => n.latitude);
      const lngs = nodes.map(n => n.longitude);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats) - 0.5, Math.min(...lngs) - 0.5],
        [Math.max(...lats) + 0.5, Math.max(...lngs) + 0.5],
      ];
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [nodes, map]);

  return null;
}

export default function NodeMap({ ownNodes, otherNodes, currentUserId, onNodeClick }: NodeMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900/50 rounded-xl">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading map...
        </div>
      </div>
    );
  }

  const allNodes = [...ownNodes, ...otherNodes];
  const center: [number, number] = allNodes.length > 0
    ? [
        allNodes.reduce((s, n) => s + n.latitude, 0) / allNodes.length,
        allNodes.reduce((s, n) => s + n.longitude, 0) / allNodes.length,
      ]
    : [13.0, 77.5];

  return (
    <div className="h-full relative">
      {/* Legend */}
      <div className="absolute top-3 right-3 z-[1000] bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-xl p-3 shadow-xl">
        <div className="space-y-1.5">
          {[
            { color: '#22c55e', label: 'Your Nodes' },
            { color: '#3b82f6', label: 'Others\' Nodes' },
            { color: '#ef4444', label: 'Infected' },
            { color: '#6b7280', label: 'Offline' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%', borderRadius: '12px' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapAutoCenter nodes={allNodes} />

        {/* Other nodes first (behind) */}
        {otherNodes.map((node) => (
          <CircleMarker
            key={`other-${node.node_id}`}
            center={[node.latitude, node.longitude]}
            radius={6}
            pathOptions={{
              fillColor: getNodeColor(node, false),
              fillOpacity: 0.7,
              color: getNodeColor(node, false),
              weight: 2,
              opacity: 0.9,
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-medium text-blue-400">Other Farm Node</p>
                <p className="text-gray-400 mt-1">Status: {node.status}</p>
                <p className="text-[10px] text-gray-500 mt-1 italic">Raw data hidden (privacy)</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Own nodes on top (clickable) */}
        {ownNodes.map((node) => (
          <CircleMarker
            key={`own-${node.node_id}`}
            center={[node.latitude, node.longitude]}
            radius={8}
            pathOptions={{
              fillColor: getNodeColor(node, true),
              fillOpacity: 0.9,
              color: '#ffffff',
              weight: 2,
              opacity: 0.8,
            }}
            eventHandlers={{
              click: () => {
                if (node.status !== 'offline') {
                  onNodeClick(node);
                }
              },
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-medium text-green-400">Your Node</p>
                <p className="text-gray-300">{node.node_id.substring(0, 8)}...</p>
                <p className="text-gray-400 mt-1">Status: {node.status}</p>
                <p className="text-green-400 mt-1 text-[10px]">Click to view details →</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
