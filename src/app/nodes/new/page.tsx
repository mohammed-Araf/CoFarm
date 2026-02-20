'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { generateTimeBasedReading } from '@/lib/simulator';

interface NodeFormData {
  node_id: string;
  latitude: string;
  longitude: string;
  elevation_m: string;
}

export default function NewNodePage() {
  const [nodes, setNodes] = useState<NodeFormData[]>([
    { node_id: '', latitude: '', longitude: '', elevation_m: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addNodeRow = () => {
    setNodes([...nodes, { node_id: '', latitude: '', longitude: '', elevation_m: '' }]);
  };

  const removeNodeRow = (index: number) => {
    if (nodes.length > 1) {
      setNodes(nodes.filter((_, i) => i !== index));
    }
  };

  const updateNode = (index: number, field: keyof NodeFormData, value: string) => {
    const updated = [...nodes];
    updated[index][field] = value;
    setNodes(updated);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data as Record<string, string>[];
        const csvNodes: NodeFormData[] = parsed
          .filter((row) => row.node_id || row.latitude || row.longitude)
          .map((row) => ({
            node_id: row.node_id || '',
            latitude: row.latitude || '',
            longitude: row.longitude || '',
            elevation_m: row.elevation_m || '',
          }));
        if (csvNodes.length > 0) {
          setNodes(csvNodes);
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const nodeRecords = nodes.map((n) => ({
        node_id: n.node_id || crypto.randomUUID(),
        latitude: parseFloat(n.latitude),
        longitude: parseFloat(n.longitude),
        elevation_m: n.elevation_m ? parseFloat(n.elevation_m) : null,
        user_id: user.id,
        status: 'online',
      }));

      const { error: insertError } = await supabase
        .from('nodes')
        .insert(nodeRecords);

      if (insertError) throw insertError;

      // Pre-populate sensor_data with 24 hours of readings for each node
      console.log('Generating 24-hour sensor data for', nodeRecords.length, 'nodes...');
      const sensorDataRecords = [];

      for (const node of nodeRecords) {
        // Generate 1440 readings (one per minute for 24 hours)
        for (let minute = 0; minute < 1440; minute++) {
          const reading = generateTimeBasedReading(node.node_id, minute);
          sensorDataRecords.push({
            ...reading,
            node_id: node.node_id,
          });
        }
      }

      console.log('Inserting', sensorDataRecords.length, 'sensor readings into database...');

      // Insert in batches of 1000 to avoid payload limits
      const batchSize = 1000;
      for (let i = 0; i < sensorDataRecords.length; i += batchSize) {
        const batch = sensorDataRecords.slice(i, i + batchSize);
        const { error: sensorError } = await supabase
          .from('sensor_data')
          .insert(batch);

        if (sensorError) {
          console.error('Error inserting sensor data batch:', sensorError);
          throw sensorError;
        }
      }

      console.log('✓ Sensor data populated successfully');
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register nodes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 mb-4 shadow-lg shadow-green-500/20">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Register Your Sensor Nodes</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Add your farm sensor sticks to start monitoring
          </p>
        </div>

        <div className="glass-card p-6">
          {/* CSV Upload */}
          <div className="mb-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-gray-300 hover:border-green-500/50 hover:text-green-400 transition-all text-sm cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <span className="text-gray-500 text-xs">
              Format: node_id, latitude, longitude, elevation_m
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {nodes.map((node, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 relative group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-green-400">
                      Node #{index + 1}
                    </span>
                    {nodes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNodeRow(index)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Node ID</label>
                      <input
                        type="text"
                        value={node.node_id}
                        onChange={(e) => updateNode(index, 'node_id', e.target.value)}
                        placeholder="Auto-generated if empty"
                        className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/40 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Elevation (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={node.elevation_m}
                        onChange={(e) => updateNode(index, 'elevation_m', e.target.value)}
                        placeholder="872.4"
                        className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/40 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Latitude *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={node.latitude}
                        onChange={(e) => updateNode(index, 'latitude', e.target.value)}
                        placeholder="13.1423"
                        className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/40 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Longitude *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={node.longitude}
                        onChange={(e) => updateNode(index, 'longitude', e.target.value)}
                        placeholder="77.5122"
                        className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/40 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={addNodeRow}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/60 border border-dashed border-gray-600/50 rounded-xl text-gray-400 hover:border-green-500/50 hover:text-green-400 transition-all text-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Another Node
              </button>

              <div className="flex-1" />

              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-xl shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all text-sm disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Registering...' : `Register ${nodes.length} Node${nodes.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
