/**
 * Metrics API Route
 * 
 * GET /api/v1/metrics/live - Get live metrics for active streams
 * GET /api/v1/metrics/history - Get historical metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('streamId');
    const modelName = searchParams.get('modelName');
    const startTime = searchParams.get('start');
    const endTime = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (streamId) where.streamId = streamId;
    if (modelName) where.modelName = modelName;
    if (startTime || endTime) {
      where.recordedAt = {};
      if (startTime) where.recordedAt.gte = new Date(startTime);
      if (endTime) where.recordedAt.lte = new Date(endTime);
    }

    const [metrics, total] = await Promise.all([
      db.modelMetric.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { recordedAt: 'desc' },
      }),
      db.modelMetric.count({ where }),
    ]);

    // Get drift statistics
    const driftStats = await db.modelMetric.aggregate({
      where,
      _avg: { driftScore: true },
      _max: { driftScore: true },
      _count: { driftDetected: true },
    });

    // Get performance over time (hourly buckets)
    const hourlyMetrics = await db.$queryRaw`
      SELECT 
        strftime('%Y-%m-%d %H:00', recordedAt) as hour,
        AVG(inferenceLatencyMs) as avgLatency,
        AVG(fpsProcessed) as avgFps,
        AVG(confidenceMean) as avgConfidence,
        SUM(totalDetections) as totalDetections
      FROM ModelMetric
      WHERE streamId ${streamId ? `= ${streamId}` : 'IS NOT NULL'}
        AND recordedAt >= datetime('now', '-24 hours')
      GROUP BY strftime('%Y-%m-%d %H:00', recordedAt)
      ORDER BY hour DESC
      LIMIT 24
    `;

    return NextResponse.json({
      data: metrics.map(m => ({
        id: m.id,
        streamId: m.streamId,
        modelName: m.modelName,
        recordedAt: m.recordedAt,
        inferenceLatencyMs: m.inferenceLatencyMs,
        fpsProcessed: m.fpsProcessed,
        confidenceMean: m.confidenceMean,
        confidenceStd: m.confidenceStd,
        objectsPerFrame: m.objectsPerFrame,
        totalDetections: m.totalDetections,
        driftScore: m.driftScore,
        driftDetected: m.driftDetected,
        cpuUsagePct: m.cpuUsagePct,
        memoryMb: m.memoryMb,
      })),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      aggregates: {
        avgDriftScore: driftStats._avg.driftScore || 0,
        maxDriftScore: driftStats._max.driftScore || 0,
        driftAlertCount: driftStats._count.driftDetected,
      },
      hourlyMetrics,
    });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
