'use client';

/**
 * LiveStream Component
 * 
 * Displays a video stream with real-time bounding box overlays.
 * Uses canvas for efficient rendering of detection boxes.
 * 
 * Features:
 * - Bounding box visualization with class-specific colors
 * - Confidence labels and track IDs
 * - Drift warning indicator
 * - Performance stats overlay
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';

// Types
interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Detection {
  classId: number;
  className: string;
  confidence: number;
  bbox: BBox;
  trackId?: number;
}

interface LiveStreamProps {
  detections: Detection[];
  fps: number;
  inferenceMs: number;
  driftScore: number;
  width?: number;
  height?: number;
  className?: string;
}

// Class colors for bounding boxes (matching config)
const CLASS_COLORS: Record<string, string> = {
  person: '#aaff44',
  car: '#44aaff',
  truck: '#ff8844',
  bicycle: '#ff44aa',
  motorcycle: '#ffaa44',
  bus: '#aa44ff',
  dog: '#44ffaa',
  cat: '#ff44ff',
  default: '#ffffff',
};

export function LiveStream({
  detections,
  fps,
  inferenceMs,
  driftScore,
  width = 640,
  height = 480,
  className,
}: LiveStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get color for a class
  const getClassColor = useCallback((className: string): string => {
    return CLASS_COLORS[className] || CLASS_COLORS.default;
  }, []);

  // Draw detections on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 64) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw each detection
    for (const det of detections) {
      const { x1, y1, x2, y2 } = det.bbox;
      const w = x2 - x1;
      const h = y2 - y1;
      const color = getClassColor(det.className);

      // Draw bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, w, h);

      // Draw semi-transparent fill
      ctx.fillStyle = color.replace(')', ', 0.08)').replace('#', 'rgba(');
      // Convert hex to rgba
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.fillRect(x1, y1, w, h);

      // Draw corner markers
      const cornerSize = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x1, y1 + cornerSize);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + cornerSize, y1);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x2 - cornerSize, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y1 + cornerSize);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x1, y2 - cornerSize);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 + cornerSize, y2);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x2 - cornerSize, y2);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 - cornerSize);
      ctx.stroke();

      // Draw label background
      const label = `${det.className} ${(det.confidence * 100).toFixed(0)}%` +
        (det.trackId !== undefined ? ` #${det.trackId}` : '');
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(label).width;
      const labelHeight = 18;

      ctx.fillStyle = color;
      ctx.fillRect(x1 - 1, y1 - labelHeight - 2, textWidth + 8, labelHeight);

      // Draw label text
      ctx.fillStyle = '#000000';
      ctx.fillText(label, x1 + 3, y1 - 6);
    }
  }, [detections, getClassColor, width, height]);

  // Format stats
  const statsText = useMemo(() => {
    return `${detections.length} objects | ${inferenceMs.toFixed(1)}ms`;
  }, [detections.length, inferenceMs]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black/90 rounded-lg overflow-hidden',
        className
      )}
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {/* Canvas for detections */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Stats overlay */}
      <div className="absolute top-3 left-3 flex gap-2">
        <span className="px-2 py-1 bg-black/70 text-green-400 text-xs font-mono rounded">
          {fps} fps
        </span>
        <span className="px-2 py-1 bg-black/70 text-blue-400 text-xs font-mono rounded">
          {inferenceMs.toFixed(1)}ms
        </span>
        <span
          className={cn(
            'px-2 py-1 bg-black/70 text-xs font-mono rounded',
            detections.length > 0 ? 'text-green-400' : 'text-gray-500'
          )}
        >
          {detections.length} objects
        </span>
      </div>

      {/* Live indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs font-mono text-green-400">LIVE</span>
      </div>

      {/* Drift warning */}
      {driftScore > 0.2 && (
        <div className="absolute bottom-3 left-3 right-3 bg-orange-500/20 border border-orange-500/50 text-orange-300 text-xs font-mono px-3 py-2 rounded">
          ⚠ Model Drift Detected: PSI={driftScore.toFixed(4)}
          {driftScore > 0.4 && ' — Retraining Recommended'}
        </div>
      )}

      {/* Detection count badge */}
      {detections.length > 0 && (
        <div className="absolute bottom-3 right-3 bg-green-500/20 border border-green-500/50 text-green-300 text-xs font-mono px-2 py-1 rounded">
          {statsText}
        </div>
      )}
    </div>
  );
}
