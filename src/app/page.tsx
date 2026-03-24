'use client';

/**
 * VisionPipeline Dashboard
 * 
 * Main dashboard view for the MLOps platform.
 * Displays real-time CV detection, metrics, and system alerts.
 * 
 * Features:
 * - Live stream visualization with bounding boxes
 * - Real-time detection charts
 * - Drift monitoring gauge
 * - Activity heatmap
 * - Class distribution
 * - Alert feed
 */

import React, { useEffect, useState } from 'react';
import { useVisionStream } from '@/hooks/use-vision-stream';
import { useVisionStore } from '@/stores/vision-store';
import { LiveStream } from '@/components/vision/LiveStream';
import { MetricCard } from '@/components/vision/MetricCard';
import { DetectionChart } from '@/components/vision/DetectionChart';
import { DriftGauge } from '@/components/vision/DriftGauge';
import { HeatmapCanvas } from '@/components/vision/HeatmapCanvas';
import { ClassDistribution } from '@/components/vision/ClassDistribution';
import { AlertFeed } from '@/components/vision/AlertFeed';
import { cn } from '@/lib/utils';
import {
  Activity,
  Gauge,
  Wifi,
  WifiOff,
  RefreshCw,
  Video,
  Brain,
  Database,
} from 'lucide-react';

export default function DashboardPage() {
  const {
    isConnected,
    connectionError,
    latestDetections,
    frameNumber,
    inferenceMs,
    fps,
    totalDetections,
    confidenceMean,
    driftScore,
    driftDetected,
    classCounts,
    detectionHistory,
    latencyHistory,
    alerts,
    reconnect,
    clearAlerts,
  } = useVisionStream();

  const { models, activeModelId, setModels } = useVisionStore();

  // Fetch models on mount
  useEffect(() => {
    fetch('/api/v1/models')
      .then(res => res.json())
      .then(data => setModels(data.data || []))
      .catch(console.error);
  }, [setModels]);

  const activeModel = models.find(m => m.id === activeModelId) || models[0];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">VisionPipeline</h1>
                <p className="text-xs text-gray-400">Production MLOps Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400">Disconnected</span>
                  </>
                )}
              </div>

              {/* Active model */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-300">
                  {activeModel ? `${activeModel.name} v${activeModel.version}` : 'YOLOv8n'}
                </span>
              </div>

              {/* Reconnect button */}
              <button
                onClick={reconnect}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Reconnect"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto p-4">
        {/* Metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <MetricCard
            label="Active Streams"
            value={1}
            color="green"
          />
          <MetricCard
            label="FPS"
            value={fps}
            unit="/s"
            color="blue"
          />
          <MetricCard
            label="Inference"
            value={inferenceMs.toFixed(1)}
            unit="ms"
            color="amber"
          />
          <MetricCard
            label="Drift Score"
            value={driftScore.toFixed(3)}
            unit="PSI"
            color={driftScore > 0.2 ? 'red' : driftScore > 0.1 ? 'amber' : 'green'}
            alert={driftScore > 0.2}
          />
          <MetricCard
            label="Confidence"
            value={(confidenceMean * 100).toFixed(1)}
            unit="%"
            color="purple"
          />
          <MetricCard
            label="Total Detections"
            value={totalDetections}
            color="green"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column - Live stream */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live stream panel */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-medium text-gray-200">Live Detection</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Frame #{frameNumber}</span>
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    )}
                  />
                </div>
              </div>
              <div className="p-4">
                <LiveStream
                  detections={latestDetections}
                  fps={fps}
                  inferenceMs={inferenceMs}
                  driftScore={driftScore}
                  width={640}
                  height={480}
                />
              </div>
            </div>

            {/* Detection chart */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-sm font-medium text-gray-200 mb-3">
                Detections Over Time
              </h2>
              <DetectionChart data={detectionHistory} height={180} />
            </div>
          </div>

          {/* Right column - Metrics & Alerts */}
          <div className="space-y-4">
            {/* Drift gauge */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-sm font-medium text-gray-200 mb-3">
                Model Drift Monitor
              </h2>
              <div className="flex justify-center">
                <DriftGauge score={driftScore} size="lg" />
              </div>
              <div className="mt-3 text-center text-xs text-gray-400">
                {driftScore < 0.1 && 'Model performance is stable'}
                {driftScore >= 0.1 && driftScore < 0.2 && 'Slight drift detected - monitor closely'}
                {driftScore >= 0.2 && driftScore < 0.4 && 'Significant drift - consider retraining'}
                {driftScore >= 0.4 && 'Critical drift - retrain immediately'}
              </div>
            </div>

            {/* Class distribution */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-sm font-medium text-gray-200 mb-3">
                Class Distribution
              </h2>
              <ClassDistribution classCounts={classCounts} />
            </div>

            {/* Alert feed */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <AlertFeed alerts={alerts} onClear={clearAlerts} />
            </div>
          </div>
        </div>

        {/* Bottom row - Heatmap and Latency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Activity heatmap */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-medium text-gray-200 mb-3">
              Activity Heatmap
            </h2>
            <HeatmapCanvas detections={latestDetections} width={640} height={240} />
          </div>

          {/* Latency chart */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h2 className="text-sm font-medium text-gray-200 mb-3">
              Inference Latency
            </h2>
            <DetectionChart
              data={latencyHistory.map(d => ({ time: d.time, count: Math.round(d.latency) }))}
              height={180}
            />
          </div>
        </div>

        {/* Architecture info */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          <h3 className="text-sm font-medium text-gray-200 mb-2">
            Pipeline Architecture
          </h3>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span>Bronze → Silver → Gold Data Lake</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>YOLOv8 + DeepSORT Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              <span>PSI Drift Detection</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>WebSocket Real-time</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 border-t border-gray-800">
        <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between text-xs text-gray-500">
          <span>VisionPipeline v1.0.0</span>
          <span>Bronze/Silver/Gold • MLflow • Evidently • WebSocket</span>
        </div>
      </footer>
    </div>
  );
}
