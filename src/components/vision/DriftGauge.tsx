'use client';

/**
 * DriftGauge Component
 * 
 * Visual indicator for model drift score (PSI).
 * Shows a gauge with color-coded zones:
 * - Green: 0 - 0.1 (No drift)
 * - Yellow: 0.1 - 0.2 (Slight drift)
 * - Orange: 0.2 - 0.4 (Significant drift)
 * - Red: 0.4+ (Critical drift)
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DriftGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const ZONES = [
  { max: 0.1, color: '#10b981', label: 'Healthy', bgClass: 'bg-green-500/20' },
  { max: 0.2, color: '#f59e0b', label: 'Monitor', bgClass: 'bg-amber-500/20' },
  { max: 0.4, color: '#f97316', label: 'Warning', bgClass: 'bg-orange-500/20' },
  { max: Infinity, color: '#ef4444', label: 'Critical', bgClass: 'bg-red-500/20' },
];

const SIZES = {
  sm: { width: 120, height: 60, strokeWidth: 8 },
  md: { width: 160, height: 80, strokeWidth: 12 },
  lg: { width: 200, height: 100, strokeWidth: 16 },
};

export function DriftGauge({
  score,
  size = 'md',
  showLabel = true,
  className,
}: DriftGaugeProps) {
  const { width, height, strokeWidth } = SIZES[size];

  // Determine zone
  const zone = useMemo(() => {
    return ZONES.find(z => score <= z.max) || ZONES[ZONES.length - 1];
  }, [score]);

  // Calculate gauge angle (180 degree arc, 0 = left, 1 = right)
  const angle = useMemo(() => {
    // Max displayable score is 0.5 for the gauge
    const normalizedScore = Math.min(score, 0.5) / 0.5;
    return normalizedScore * 180;
  }, [score]);

  // SVG arc path calculation
  const createArc = (startAngle: number, endAngle: number, radius: number) => {
    const startRad = ((180 - startAngle) * Math.PI) / 180;
    const endRad = ((180 - endAngle) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height - 10;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy - radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy - radius * Math.sin(endRad);

    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  const radius = (Math.min(width, height * 2) - strokeWidth) / 2 - 10;
  const backgroundArc = createArc(0, 180, radius);
  const valueArc = createArc(180, 180 - angle, radius);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d={valueArc}
          fill="none"
          stroke={zone.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />

        {/* Center value */}
        <text
          x={width / 2}
          y={height - 25}
          textAnchor="middle"
          className="fill-current text-lg font-bold font-mono"
          style={{ fill: zone.color }}
        >
          {score.toFixed(3)}
        </text>
      </svg>

      {/* Label */}
      {showLabel && (
        <div className={cn('text-xs font-medium mt-1 px-2 py-0.5 rounded', zone.bgClass)}>
          <span style={{ color: zone.color }}>{zone.label}</span>
        </div>
      )}

      {/* PSI indicator */}
      <div className="text-xs text-gray-500 mt-1">
        PSI Score
      </div>
    </div>
  );
}
