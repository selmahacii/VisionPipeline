'use client';

/**
 * AlertFeed Component
 * 
 * Real-time feed of system alerts with severity indicators.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';

interface AlertItem {
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  streamId?: string;
  data?: Record<string, unknown>;
}

interface AlertFeedProps {
  alerts: AlertItem[];
  maxItems?: number;
  className?: string;
  onClear?: () => void;
}

const severityConfig = {
  INFO: {
    icon: Info,
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    textClass: 'text-blue-400',
    iconClass: 'text-blue-400',
  },
  WARNING: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    textClass: 'text-amber-400',
    iconClass: 'text-amber-400',
  },
  CRITICAL: {
    icon: AlertCircle,
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    textClass: 'text-red-400',
    iconClass: 'text-red-400',
  },
};

export function AlertFeed({
  alerts,
  maxItems = 10,
  className,
  onClear,
}: AlertFeedProps) {
  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Alerts</h3>
        {alerts.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-64">
        {displayAlerts.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
            <CheckCircle className="w-4 h-4 mr-2" />
            No alerts
          </div>
        ) : (
          displayAlerts.map((alert, index) => {
            const config = severityConfig[alert.severity];
            const Icon = config.icon;

            return (
              <div
                key={`${alert.alertType}-${index}`}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-lg border',
                  config.bgClass,
                  config.borderClass
                )}
              >
                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.iconClass)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium', config.textClass)}>
                      {alert.alertType.replace(/_/g, ' ')}
                    </span>
                    {alert.streamId && (
                      <span className="text-xs text-gray-500 font-mono">
                        {alert.streamId.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5 truncate">
                    {alert.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Count badge */}
      {alerts.length > maxItems && (
        <div className="mt-2 text-center text-xs text-gray-500">
          +{alerts.length - maxItems} more alerts
        </div>
      )}
    </div>
  );
}
