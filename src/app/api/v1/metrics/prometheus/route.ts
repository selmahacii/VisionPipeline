/**
 * Prometheus Metrics API Route
 * 
 * GET /api/v1/metrics/prometheus - Export metrics in Prometheus format
 * 
 * This endpoint exposes metrics for Prometheus scraping:
 * - Frame processing rates
 * - Detection counts by class
 * - Inference latency histogram
 * - Drift scores
 * - Active stream counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Prometheus metric types
interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: Array<{
    labels: Record<string, string>;
    value: number;
  }>;
}

function formatPrometheusMetric(metric: PrometheusMetric): string {
  let output = `# HELP ${metric.name} ${metric.help}\n`;
  output += `# TYPE ${metric.name} ${metric.type}\n`;

  for (const { labels, value } of metric.values) {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    if (labelStr) {
      output += `${metric.name}{${labelStr}} ${value}\n`;
    } else {
      output += `${metric.name} ${value}\n`;
    }
  }

  return output;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch metrics from database
    const [streams, totalDetections, totalMetrics, recentMetrics, classDistribution] = await Promise.all([
      db.videoStream.count({ where: { status: 'PROCESSING' } }),
      db.detection.count(),
      db.modelMetric.count(),
      db.modelMetric.findMany({
        take: 100,
        orderBy: { recordedAt: 'desc' },
      }),
      db.detection.groupBy({
        by: ['className'],
        _count: { className: true },
      }),
    ]);

    // Calculate aggregate metrics
    const avgLatency = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.inferenceLatencyMs, 0) / recentMetrics.length
      : 0;
    
    const avgDrift = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.driftScore, 0) / recentMetrics.length
      : 0;

    const alertsTriggered = recentMetrics.filter(m => m.driftDetected).length;

    // Build Prometheus metrics
    const metrics: PrometheusMetric[] = [
      {
        name: 'visionpipeline_active_streams',
        help: 'Number of currently active video streams',
        type: 'gauge',
        values: [{ labels: {}, value: streams }],
      },
      {
        name: 'visionpipeline_detections_total',
        help: 'Total number of objects detected',
        type: 'counter',
        values: [{ labels: {}, value: totalDetections }],
      },
      {
        name: 'visionpipeline_frames_processed_total',
        help: 'Total number of frames processed',
        type: 'counter',
        values: [{ labels: {}, value: totalMetrics }],
      },
      {
        name: 'visionpipeline_inference_latency_ms',
        help: 'Average inference latency in milliseconds',
        type: 'gauge',
        values: [{ labels: {}, value: Math.round(avgLatency * 100) / 100 }],
      },
      {
        name: 'visionpipeline_drift_score',
        help: 'Current model drift score (PSI)',
        type: 'gauge',
        values: [{ labels: {}, value: Math.round(avgDrift * 10000) / 10000 }],
      },
      {
        name: 'visionpipeline_drift_alerts_total',
        help: 'Total number of drift alerts triggered',
        type: 'counter',
        values: [{ labels: {}, value: alertsTriggered }],
      },
      {
        name: 'visionpipeline_detections_by_class',
        help: 'Number of detections per class',
        type: 'counter',
        values: classDistribution.map(c => ({
          labels: { class: c.className },
          value: c._count.className,
        })),
      },
    ];

    // Format as Prometheus text format
    const output = metrics.map(formatPrometheusMetric).join('\n');

    return new NextResponse(output, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[API] Error generating Prometheus metrics:', error);
    return new NextResponse('# Error generating metrics\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
