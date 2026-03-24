'use client';

/**
 * HeatmapCanvas Component
 * 
 * Visualizes activity heatmap for a stream.
 * Shows where detections are concentrated.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HeatmapCanvasProps {
  detections: Array<{
    bbox: { x1: number; y1: number; x2: number; y2: number };
    className: string;
  }>;
  width?: number;
  height?: number;
  className?: string;
}

export function HeatmapCanvas({
  detections,
  width = 320,
  height = 240,
  className,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatmapData = useRef<Float32Array | null>(null);

  // Initialize heatmap data
  useEffect(() => {
    if (!heatmapData.current) {
      heatmapData.current = new Float32Array(width * height);
    }
  }, [width, height]);

  // Update heatmap with detections
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmapData.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Decay existing heatmap
    const decay = 0.98;
    for (let i = 0; i < heatmapData.current.length; i++) {
      heatmapData.current[i] *= decay;
    }

    // Add current detections
    for (const det of detections) {
      const { x1, y1, x2, y2 } = det.bbox;
      // Scale to canvas size
      const scaleX = width / 640;
      const scaleY = height / 480;
      const sx1 = Math.floor(x1 * scaleX);
      const sy1 = Math.floor(y1 * scaleY);
      const sx2 = Math.floor(x2 * scaleX);
      const sy2 = Math.floor(y2 * scaleY);

      // Add heat in bounding box area
      for (let y = sy1; y < sy2 && y < height; y++) {
        for (let x = sx1; x < sx2 && x < width; x++) {
          const idx = y * width + x;
          if (heatmapData.current && idx >= 0 && idx < heatmapData.current.length) {
            heatmapData.current[idx] = Math.min(heatmapData.current[idx] + 2, 255);
          }
        }
      }
    }

    // Render heatmap
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < heatmapData.current.length; i++) {
      const value = heatmapData.current[i];
      const idx = i * 4;
      
      // Jet colormap approximation
      if (value < 64) {
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = (value / 64) * 128 + 127;
      } else if (value < 128) {
        imageData.data[idx] = 0;
        imageData.data[idx + 1] = ((value - 64) / 64) * 255;
        imageData.data[idx + 2] = 255 - ((value - 64) / 64) * 127;
      } else if (value < 192) {
        imageData.data[idx] = ((value - 128) / 64) * 255;
        imageData.data[idx + 1] = 255;
        imageData.data[idx + 2] = 128 - ((value - 128) / 64) * 128;
      } else {
        imageData.data[idx] = 255;
        imageData.data[idx + 1] = 255 - ((value - 192) / 63) * 255;
        imageData.data[idx + 2] = 0;
      }
      imageData.data[idx + 3] = Math.min(value * 2, 200);
    }
    ctx.putImageData(imageData, 0, 0);
  }, [detections, width, height]);

  return (
    <div className={cn('relative rounded-lg overflow-hidden bg-black/50', className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
      />
      <div className="absolute bottom-2 left-2 text-xs text-gray-400 bg-black/50 px-2 py-1 rounded">
        Activity Heatmap
      </div>
    </div>
  );
}
