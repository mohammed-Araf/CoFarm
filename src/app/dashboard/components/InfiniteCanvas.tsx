'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { CriticalAlert, InterClusterAlert, AlertLine, ALERT_RADIUS_METERS, ALERT_TYPE_CONFIG } from '@/lib/alertEngine';

interface NodeData {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  status: string;
  user_id: string;
}

interface InfiniteCanvasProps {
  ownNodes: NodeData[];
  otherNodes: NodeData[];
  currentUserId: string;
  onNodeClick: (node: NodeData) => void;
  criticalAlerts?: CriticalAlert[];
  alertLines?: AlertLine[];
}

const NODE_RADIUS = 10;
const NODE_RADIUS_OTHER = 7;
const HIT_RADIUS = 16;
const GRID_SIZE = 80;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

// 1 degree latitude ≈ 111,320 meters
const METERS_PER_DEG_LAT = 111320;
// 1 unit on canvas = 10 meters
const UNIT_METERS = 10;
// 500 meters = 50 canvas units
const ALERT_RADIUS_UNITS = ALERT_RADIUS_METERS / UNIT_METERS;

function getNodeColor(node: NodeData, isOwn: boolean, isCritical: boolean): string {
  if (isCritical) return '#ef4444';
  if (node.status === 'infected') return '#ef4444';
  if (node.status === 'offline') return '#6b7280';
  return isOwn ? '#22c55e' : '#3b82f6';
}

function getNodeGlow(node: NodeData, isOwn: boolean, isCritical: boolean): string {
  if (isCritical) return 'rgba(239,68,68,0.6)';
  if (node.status === 'infected') return 'rgba(239,68,68,0.4)';
  if (node.status === 'offline') return 'rgba(107,114,128,0.2)';
  return isOwn ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.3)';
}

/**
 * Convert lat/lng to x/y plane where 1 unit = 10 meters.
 * Uses a reference point (mean of own nodes) as origin.
 */
function latLngToXY(
  lat: number,
  lng: number,
  refLat: number,
  refLng: number
): { x: number; y: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180);
  const x = ((lng - refLng) * metersPerDegLng) / UNIT_METERS;
  const y = -((lat - refLat) * METERS_PER_DEG_LAT) / UNIT_METERS; // negative because canvas y goes down
  return { x, y };
}

export default function InfiniteCanvas({
  ownNodes,
  otherNodes,
  onNodeClick,
  criticalAlerts = [],
  alertLines = [],
}: InfiniteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera state stored in refs for animation loop performance
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<NodeData | null>(null);
  const tooltipRef = useRef<{ node: NodeData; x: number; y: number; timer: NodeJS.Timeout | null } | null>(null);
  const [, forceUpdate] = useState(0);

  // Build a set of critical node IDs for quick lookup
  const criticalNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const ca of criticalAlerts) set.add(ca.sourceNodeId);
    return set;
  }, [criticalAlerts]);

  // Compute reference point: mean of own nodes
  const refPoint = useMemo(() => {
    if (ownNodes.length === 0) {
      const allNodes = [...ownNodes, ...otherNodes];
      if (allNodes.length === 0) return { lat: 0, lng: 0 };
      return {
        lat: allNodes.reduce((s, n) => s + n.latitude, 0) / allNodes.length,
        lng: allNodes.reduce((s, n) => s + n.longitude, 0) / allNodes.length,
      };
    }
    return {
      lat: ownNodes.reduce((s, n) => s + n.latitude, 0) / ownNodes.length,
      lng: ownNodes.reduce((s, n) => s + n.longitude, 0) / ownNodes.length,
    };
  }, [ownNodes, otherNodes]);

  // Convert lat/lng to canvas coordinates using ref point
  const toXY = useCallback(
    (lat: number, lng: number) => latLngToXY(lat, lng, refPoint.lat, refPoint.lng),
    [refPoint]
  );

  // Pre-compute all node positions
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    [...ownNodes, ...otherNodes].forEach((node) => {
      positions.set(node.node_id, toXY(node.latitude, node.longitude));
    });
    return positions;
  }, [ownNodes, otherNodes, toXY]);

  // Auto-fit on mount / when nodes change
  useEffect(() => {
    const allNodes = [...ownNodes, ...otherNodes];
    if (allNodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    // Wait for canvas to have dimensions
    if (canvas.width === 0 || canvas.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasW = canvas.width / dpr;
    const canvasH = canvas.height / dpr;

    const positions = allNodes.map((n) => nodePositions.get(n.node_id)!).filter(Boolean);
    if (positions.length === 0) return;

    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const spanX = maxX - minX || 100; // fallback if all nodes overlap
    const spanY = maxY - minY || 100;

    const padding = 120;
    const zoomX = (canvasW - padding * 2) / spanX;
    const zoomY = (canvasH - padding * 2) / spanY;
    const zoom = Math.max(MIN_ZOOM, Math.min(Math.min(zoomX, zoomY), MAX_ZOOM));

    cameraRef.current = {
      x: canvasW / 2 - centerX * zoom,
      y: canvasH / 2 - centerY * zoom,
      zoom,
    };
    forceUpdate((v) => v + 1);
  }, [ownNodes, otherNodes, nodePositions]);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
      forceUpdate((v) => v + 1);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    // Initial resize
    resize();
    return () => ro.disconnect();
  }, []);

  // Drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const allNodes = [...otherNodes, ...ownNodes]; // others behind, own on top

    const draw = () => {
      const now = Date.now();
      const { x: camX, y: camY, zoom } = cameraRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Grid
      const gridStep = GRID_SIZE * zoom;
      if (gridStep > 10) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;

        const startX = ((camX % gridStep) + gridStep) % gridStep;
        const startY = ((camY % gridStep) + gridStep) % gridStep;

        ctx.beginPath();
        for (let gx = startX; gx < w; gx += gridStep) {
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
        }
        for (let gy = startY; gy < h; gy += gridStep) {
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
        }
        ctx.stroke();
      }

      // ── RED RADIANCE ZONES ─────────────────────────────────────
      for (const ca of criticalAlerts) {
        const pos = nodePositions.get(ca.sourceNodeId);
        if (!pos) continue;

        const sx = pos.x * zoom + camX;
        const sy = pos.y * zoom + camY;
        const baseRadiusPixels = ALERT_RADIUS_UNITS * zoom;

        // Pulsing animation: radius oscillates ±8%
        const pulse = 1 + 0.08 * Math.sin(now * 0.003);
        const radiusPixels = baseRadiusPixels * pulse;

        // Outer glow ring
        const outerGlow = ctx.createRadialGradient(sx, sy, radiusPixels * 0.7, sx, sy, radiusPixels * 1.15);
        outerGlow.addColorStop(0, 'rgba(239,68,68,0)');
        outerGlow.addColorStop(0.6, 'rgba(239,68,68,0.03)');
        outerGlow.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, radiusPixels * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // Main radiance gradient
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radiusPixels);
        gradient.addColorStop(0, 'rgba(239,68,68,0.35)');
        gradient.addColorStop(0.3, 'rgba(239,68,68,0.20)');
        gradient.addColorStop(0.6, 'rgba(239,68,68,0.10)');
        gradient.addColorStop(0.85, 'rgba(239,68,68,0.04)');
        gradient.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, radiusPixels, 0, Math.PI * 2);
        ctx.fill();

        // Border ring with pulsing opacity
        const ringOpacity = 0.25 + 0.15 * Math.sin(now * 0.004);
        ctx.strokeStyle = `rgba(239,68,68,${ringOpacity})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, radiusPixels, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // "500m" label on the ring
        if (zoom > 0.06) {
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.fillStyle = `rgba(239,68,68,${0.5 + 0.2 * Math.sin(now * 0.003)})`;
          ctx.textAlign = 'center';
          ctx.fillText('100m radius', sx, sy - radiusPixels - 6);
        }
      }

      // ── GLOWING ALERT CONNECTION LINES ─────────────────────────
      for (const line of alertLines) {
        const srcPos = nodePositions.get(line.sourceNodeId);
        const tgtPos = nodePositions.get(line.targetNodeId);
        if (!srcPos || !tgtPos) continue;

        const sx1 = srcPos.x * zoom + camX;
        const sy1 = srcPos.y * zoom + camY;
        const sx2 = tgtPos.x * zoom + camX;
        const sy2 = tgtPos.y * zoom + camY;

        // Animated flowing dash
        const dashOffset = -(now * 0.05) % 40;

        // Outer glow
        ctx.save();
        ctx.shadowColor = 'rgba(239,68,68,0.6)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(239,68,68,0.15)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.restore();

        // Main line with gradient
        const lineGrad = ctx.createLinearGradient(sx1, sy1, sx2, sy2);
        lineGrad.addColorStop(0, 'rgba(239,68,68,0.9)');
        lineGrad.addColorStop(0.5, 'rgba(249,115,22,0.8)');
        lineGrad.addColorStop(1, 'rgba(239,68,68,0.9)');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = dashOffset;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Particles flowing along the line
        const lineLen = Math.sqrt((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2);
        const numParticles = Math.max(2, Math.floor(lineLen / 60));
        for (let i = 0; i < numParticles; i++) {
          const t = ((now * 0.001 + i * (1 / numParticles)) % 1);
          const px = sx1 + (sx2 - sx1) * t;
          const py = sy1 + (sy2 - sy1) * t;
          const particleAlpha = 0.5 + 0.5 * Math.sin(t * Math.PI);

          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,68,68,${particleAlpha})`;
          ctx.fill();

          // Particle glow
          ctx.beginPath();
          ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,68,68,${particleAlpha * 0.25})`;
          ctx.fill();
        }

        // "ALERT" label at midpoint
        if (zoom > 0.08) {
          const mx = (sx1 + sx2) / 2;
          const my = (sy1 + sy2) / 2;
          const alertPulse = 0.6 + 0.4 * Math.sin(now * 0.005);

          ctx.font = 'bold 9px Inter, system-ui, sans-serif';
          ctx.fillStyle = `rgba(239,68,68,${alertPulse})`;
          ctx.textAlign = 'center';
          ctx.fillText('⚡ ALERT', mx, my - 8);
        }
      }

      // Connection lines between own nodes
      if (ownNodes.length > 1) {
        ctx.strokeStyle = 'rgba(34,197,94,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i < ownNodes.length; i++) {
          for (let j = i + 1; j < ownNodes.length; j++) {
            const a = nodePositions.get(ownNodes[i].node_id);
            const b = nodePositions.get(ownNodes[j].node_id);
            if (!a || !b) continue;
            ctx.moveTo(a.x * zoom + camX, a.y * zoom + camY);
            ctx.lineTo(b.x * zoom + camX, b.y * zoom + camY);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Nodes
      for (const node of allNodes) {
        const isOwn = ownNodes.some((n) => n.node_id === node.node_id);
        const isCritical = criticalNodeIds.has(node.node_id);
        const pos = nodePositions.get(node.node_id);
        if (!pos) continue;
        const sx = pos.x * zoom + camX;
        const sy = pos.y * zoom + camY;

        // Skip if off-screen
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

        const r = isOwn ? NODE_RADIUS : NODE_RADIUS_OTHER;
        const color = getNodeColor(node, isOwn, isCritical);
        const glow = getNodeGlow(node, isOwn, isCritical);
        const isHovered = hoveredNodeRef.current?.node_id === node.node_id;

        // Enhanced glow for critical nodes — pulsing red aura
        if (isCritical) {
          const critPulse = 1 + 0.3 * Math.sin(now * 0.006);
          // Outer danger halo
          ctx.beginPath();
          ctx.arc(sx, sy, r * 4 * critPulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,68,68,${0.12 + 0.08 * Math.sin(now * 0.004)})`;
          ctx.fill();

          // Middle ring
          ctx.beginPath();
          ctx.arc(sx, sy, r * 2.5 * critPulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,68,68,${0.2 + 0.1 * Math.sin(now * 0.005)})`;
          ctx.fill();
        }

        // Glow
        ctx.beginPath();
        ctx.arc(sx, sy, r * (isHovered ? 2.5 : 1.8), 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Circle
        ctx.beginPath();
        ctx.arc(sx, sy, r * (isHovered ? 1.2 : 1), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isOwn) {
          ctx.strokeStyle = isCritical ? '#991b1b' : '#1a1a1a';
          ctx.lineWidth = isCritical ? 3 : 2;
          ctx.stroke();
        }

        // Critical icon badge
        if (isCritical && zoom > 0.08) {
          const ca = criticalAlerts.find(a => a.sourceNodeId === node.node_id);
          if (ca) {
            const cfg = ALERT_TYPE_CONFIG[ca.type];
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(cfg.icon, sx, sy - r - 8);
          }
        }

        // Label
        if (zoom > 0.1) {
          ctx.font = `${isHovered ? 'bold ' : ''}11px Inter, system-ui, sans-serif`;
          ctx.fillStyle = isCritical ? '#dc2626' : (isHovered ? '#000000' : 'rgba(0,0,0,0.5)');
          ctx.textAlign = 'center';
          ctx.fillText(node.node_id.substring(0, 8), sx, sy + r + 14);
          if (isHovered) {
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = isCritical ? 'rgba(220,38,38,0.7)' : 'rgba(0,0,0,0.35)';
            ctx.fillText(
              isCritical ? '⚠ CRITICAL ALERT' : (isOwn ? 'click to view' : 'discovery only'),
              sx, sy + r + 28
            );
          }
        }
      }

      // Scale bar
      const scaleUnits = 100; // 100 units = 1000 meters = 1km
      const scalePixels = scaleUnits * zoom;
      if (scalePixels > 20) {
        const barY = h - 20;
        const barX = 16;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barX, barY);
        ctx.lineTo(barX + scalePixels, barY);
        ctx.moveTo(barX, barY - 4);
        ctx.lineTo(barX, barY + 4);
        ctx.moveTo(barX + scalePixels, barY - 4);
        ctx.lineTo(barX + scalePixels, barY + 4);
        ctx.stroke();

        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.textAlign = 'center';
        ctx.fillText('1 km', barX + scalePixels / 2, barY - 8);
      }

      // Tooltip for other nodes
      const tip = tooltipRef.current;
      if (tip) {
        const pos = nodePositions.get(tip.node.node_id);
        if (pos) {
          const tx = pos.x * zoom + camX;
          const ty = pos.y * zoom + camY;
          const label = `🔒 ${tip.node.node_id.substring(0, 8)}... — Not your node`;
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          const textW = ctx.measureText(label).width;
          const pad = 10;
          const boxW = textW + pad * 2;
          const boxH = 28;
          const bx = tx - boxW / 2;
          const by = ty - 30 - boxH;

          // Box
          ctx.fillStyle = 'rgba(30,41,59,0.95)';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxW, boxH, 6);
          ctx.fill();
          ctx.strokeStyle = 'rgba(59,130,246,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Text
          ctx.fillStyle = '#93c5fd';
          ctx.textAlign = 'center';
          ctx.fillText(label, tx, by + boxH / 2 + 4);
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [ownNodes, otherNodes, nodePositions, criticalAlerts, alertLines, criticalNodeIds]);

  // Event handlers
  const getNodeAtScreen = useCallback(
    (sx: number, sy: number): NodeData | null => {
      const cam = cameraRef.current;
      // Check own nodes first (they're on top)
      for (let i = ownNodes.length - 1; i >= 0; i--) {
        const pos = nodePositions.get(ownNodes[i].node_id);
        if (!pos) continue;
        const nx = pos.x * cam.zoom + cam.x;
        const ny = pos.y * cam.zoom + cam.y;
        const dist = Math.sqrt((sx - nx) ** 2 + (sy - ny) ** 2);
        if (dist < HIT_RADIUS) return ownNodes[i];
      }
      for (let i = otherNodes.length - 1; i >= 0; i--) {
        const pos = nodePositions.get(otherNodes[i].node_id);
        if (!pos) continue;
        const nx = pos.x * cam.zoom + cam.x;
        const ny = pos.y * cam.zoom + cam.y;
        const dist = Math.sqrt((sx - nx) ** 2 + (sy - ny) ** 2);
        if (dist < HIT_RADIUS) return otherNodes[i];
      }
      return null;
    },
    [ownNodes, otherNodes, nodePositions]
  );

  const getMousePos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);
      isDraggingRef.current = true;
      dragStartRef.current = pos;
      lastMouseRef.current = pos;
    },
    [getMousePos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);

      if (isDraggingRef.current) {
        const dx = pos.x - lastMouseRef.current.x;
        const dy = pos.y - lastMouseRef.current.y;
        cameraRef.current.x += dx;
        cameraRef.current.y += dy;
        lastMouseRef.current = pos;
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = 'grabbing';
      } else {
        const node = getNodeAtScreen(pos.x, pos.y);
        hoveredNodeRef.current = node;
        const canvas = canvasRef.current;
        if (canvas) {
          if (node) {
            if (ownNodes.some((n) => n.node_id === node.node_id)) {
              canvas.style.cursor = 'pointer';
            } else {
              canvas.style.cursor = 'not-allowed';
            }
          } else {
            canvas.style.cursor = 'grab';
          }
        }
      }
    },
    [getMousePos, getNodeAtScreen, ownNodes]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);
      isDraggingRef.current = false;

      // Only count as click if barely moved
      const dx = Math.abs(pos.x - dragStartRef.current.x);
      const dy = Math.abs(pos.y - dragStartRef.current.y);
      if (dx < 5 && dy < 5) {
        const node = getNodeAtScreen(pos.x, pos.y);
        if (node) {
          if (ownNodes.some((n) => n.node_id === node.node_id) && node.status !== 'offline') {
            // Clear tooltip and open detail view for own node
            if (tooltipRef.current?.timer) clearTimeout(tooltipRef.current.timer);
            tooltipRef.current = null;
            onNodeClick(node);
          } else if (!ownNodes.some((n) => n.node_id === node.node_id)) {
            // Show tooltip for other user's node
            if (tooltipRef.current?.timer) clearTimeout(tooltipRef.current.timer);
            const timer = setTimeout(() => {
              tooltipRef.current = null;
            }, 2500);
            tooltipRef.current = { node, x: pos.x, y: pos.y, timer };
          }
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const node = getNodeAtScreen(pos.x, pos.y);
        canvas.style.cursor = node ? 'pointer' : 'grab';
      }
    },
    [getMousePos, getNodeAtScreen, ownNodes, onNodeClick]
  );

  // Native wheel listener with passive:false to prevent trackpad page zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const posX = e.clientX - rect.left;
      const posY = e.clientY - rect.top;
      const cam = cameraRef.current;
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * zoomFactor));

      // Zoom towards mouse position
      cam.x = posX - (posX - cam.x) * (newZoom / cam.zoom);
      cam.y = posY - (posY - cam.y) * (newZoom / cam.zoom);
      cam.zoom = newZoom;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    hoveredNodeRef.current = null;
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full relative rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'grab', touchAction: 'none' }}
      />

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-xl border border-gray-200 rounded-xl p-3 shadow-md">
        <div className="space-y-1.5">
          {[
            { color: '#22c55e', label: 'Your Nodes' },
            { color: '#3b82f6', label: "Others' Nodes" },
            { color: '#ef4444', label: 'Infected' },
            { color: '#6b7280', label: 'Offline' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
              />
              <span className="text-[10px] text-gray-600">{label}</span>
            </div>
          ))}
          {criticalAlerts.length > 0 && (
            <>
              <div className="border-t border-gray-200 my-1" />
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.8)' }}
                />
                <span className="text-[10px] text-red-500 font-semibold">Critical Zone (100m)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => {
            const cam = cameraRef.current;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const cx = canvas.clientWidth / 2;
            const cy = canvas.clientHeight / 2;
            const newZoom = Math.min(MAX_ZOOM, cam.zoom * 1.3);
            cam.x = cx - (cx - cam.x) * (newZoom / cam.zoom);
            cam.y = cy - (cy - cam.y) * (newZoom / cam.zoom);
            cam.zoom = newZoom;
          }}
          className="w-8 h-8 bg-white/90 border border-gray-200 rounded-lg text-gray-600 hover:text-black hover:border-gray-400 transition-colors text-lg flex items-center justify-center cursor-pointer shadow-sm"
        >
          +
        </button>
        <button
          onClick={() => {
            const cam = cameraRef.current;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const cx = canvas.clientWidth / 2;
            const cy = canvas.clientHeight / 2;
            const newZoom = Math.max(MIN_ZOOM, cam.zoom * 0.7);
            cam.x = cx - (cx - cam.x) * (newZoom / cam.zoom);
            cam.y = cy - (cy - cam.y) * (newZoom / cam.zoom);
            cam.zoom = newZoom;
          }}
          className="w-8 h-8 bg-white/90 border border-gray-200 rounded-lg text-gray-600 hover:text-black hover:border-gray-400 transition-colors text-lg flex items-center justify-center cursor-pointer shadow-sm"
        >
          −
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-1 left-3 z-10 text-[10px] text-gray-400">
        Scroll to zoom · Drag to pan
      </div>
    </div>
  );
}
