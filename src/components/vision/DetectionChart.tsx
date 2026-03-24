'use client';

/**
 * DetectionChart Component
 * 
 * Real-time chart showing detection counts over time.
 * Uses Recharts for smooth rendering.
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

interface DataPoint {
  time: string;
  count: number;
  timestamp?: number;
}

interface DetectionChartProps {
  data: DataPoint[];
  height?: number;
  className?: string;
}

export function DetectionChart({ data, height = 200, className }: DetectionChartProps) {
  // Format data for chart
  const chartData = useMemo(() => {
    return data.map(d => ({
      time: d.time,
      count: d.count,
    }));
  }, [data]);

  // Calculate stats
  const stats = useMemo(() => {
    if (data.length === 0) return { max: 0, avg: 0, total: 0 };
    const counts = data.map(d => d.count);
    return {
      max: Math.max(...counts),
      avg: counts.reduce((a, b) => a + b, 0) / counts.length,
      total: counts.reduce((a, b) => a + b, 0),
    };
  }, [data]);

  return (
    <div className={cn('w-full', className)}>
      {/* Stats row */}
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Max: {stats.max}</span>
        <span>Avg: {stats.avg.toFixed(1)}</span>
        <span>Total: {stats.total}</span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="detectionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="time"
            stroke="#6b7280"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#10b981' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#detectionGradient)"
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
