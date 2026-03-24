'use client';

/**
 * MetricCard Component
 * 
 * Displays a single metric with optional trend indicator.
 * Used for the dashboard metrics row.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'gray';
  alert?: boolean;
  className?: string;
}

const colorClasses = {
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    value: 'text-green-300',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    value: 'text-blue-300',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    value: 'text-amber-300',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    value: 'text-red-300',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    value: 'text-purple-300',
  },
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    value: 'text-gray-300',
  },
};

export function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  color = 'gray',
  alert = false,
  className,
}: MetricCardProps) {
  const colors = colorClasses[color];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'relative p-4 rounded-lg border backdrop-blur-sm',
        colors.bg,
        colors.border,
        alert && 'ring-2 ring-amber-500/50 animate-pulse',
        className
      )}
    >
      {/* Label */}
      <div className={cn('text-xs font-medium uppercase tracking-wider mb-2', colors.text)}>
        {label}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-bold font-mono', colors.value)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span className={cn('text-sm font-mono', colors.text)}>
            {unit}
          </span>
        )}
      </div>

      {/* Trend */}
      {(trend || trendValue) && (
        <div className="flex items-center gap-1 mt-2">
          {trend && (
            <TrendIcon
              className={cn(
                'w-3 h-3',
                trend === 'up' && 'text-green-400',
                trend === 'down' && 'text-red-400',
                trend === 'neutral' && 'text-gray-400'
              )}
            />
          )}
          {trendValue && (
            <span className="text-xs text-gray-400 font-mono">
              {trendValue}
            </span>
          )}
        </div>
      )}

      {/* Alert indicator */}
      {alert && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
      )}
    </div>
  );
}
