'use client';

/**
 * ClassDistribution Component
 * 
 * Horizontal bar chart showing the distribution of detected classes.
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ClassDistributionProps {
  classCounts: Record<string, number>;
  maxItems?: number;
  className?: string;
}

const CLASS_COLORS: Record<string, string> = {
  person: '#aaff44',
  car: '#44aaff',
  truck: '#ff8844',
  bicycle: '#ff44aa',
  motorcycle: '#ffaa44',
  bus: '#aa44ff',
};

export function ClassDistribution({
  classCounts,
  maxItems = 6,
  className,
}: ClassDistributionProps) {
  // Sort and limit classes
  const sortedClasses = useMemo(() => {
    return Object.entries(classCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxItems);
  }, [classCounts, maxItems]);

  const maxCount = useMemo(() => {
    return Math.max(...Object.values(classCounts), 1);
  }, [classCounts]);

  const total = useMemo(() => {
    return Object.values(classCounts).reduce((a, b) => a + b, 0);
  }, [classCounts]);

  if (sortedClasses.length === 0) {
    return (
      <div className={cn('text-gray-500 text-sm', className)}>
        No detections yet
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {sortedClasses.map(([className, count]) => {
        const percentage = (count / maxCount) * 100;
        const color = CLASS_COLORS[className] || '#ffffff';

        return (
          <div key={className} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-300 font-medium">{className}</span>
              <span className="text-gray-400 font-mono">
                {count} ({((count / total) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
