/**
 * Stream Detail API Route
 * 
 * GET    /api/v1/streams/[id] - Get stream details
 * PATCH  /api/v1/streams/[id] - Update stream
 * DELETE /api/v1/streams/[id] - Delete stream
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Params = Promise<{ id: string }>;

// GET /api/v1/streams/[id]
export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const stream = await db.videoStream.findUnique({
      where: { id },
      include: {
        _count: { select: { detections: true, metrics: true } },
      },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found', message: `No stream with id ${id}` },
        { status: 404 }
      );
    }

    // Get recent detections
    const recentDetections = await db.detection.findMany({
      where: { streamId: id },
      take: 10,
      orderBy: { detectedAt: 'desc' },
    });

    // Get recent metrics
    const recentMetrics = await db.modelMetric.findMany({
      where: { streamId: id },
      take: 10,
      orderBy: { recordedAt: 'desc' },
    });

    return NextResponse.json({
      id: stream.id,
      name: stream.name,
      sourceType: stream.sourceType,
      sourceUri: stream.sourceUri,
      status: stream.status,
      activeModelId: stream.activeModelId,
      fpsActual: stream.fpsActual,
      totalFrames: stream.totalFrames,
      totalObjects: stream.totalObjects,
      config: JSON.parse(stream.config || '{}'),
      createdAt: stream.createdAt,
      lastActiveAt: stream.lastActiveAt,
      counts: {
        detections: stream._count.detections,
        metrics: stream._count.metrics,
      },
      recentDetections: recentDetections.map(d => ({
        id: d.id,
        className: d.className,
        confidence: d.confidence,
        trackId: d.trackId,
        bbox: JSON.parse(d.bbox),
        detectedAt: d.detectedAt,
      })),
      recentMetrics: recentMetrics.map(m => ({
        id: m.id,
        modelName: m.modelName,
        inferenceLatencyMs: m.inferenceLatencyMs,
        fpsProcessed: m.fpsProcessed,
        confidenceMean: m.confidenceMean,
        driftScore: m.driftScore,
        driftDetected: m.driftDetected,
        recordedAt: m.recordedAt,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching stream:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/streams/[id]
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const stream = await db.videoStream.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.sourceUri && { sourceUri: body.sourceUri }),
        ...(body.status && { status: body.status as any }),
        ...(body.activeModelId !== undefined && { activeModelId: body.activeModelId }),
        ...(body.config && { config: JSON.stringify(body.config) }),
        ...(body.fpsActual !== undefined && { fpsActual: body.fpsActual }),
        ...(body.totalFrames !== undefined && { totalFrames: body.totalFrames }),
        ...(body.totalObjects !== undefined && { totalObjects: body.totalObjects }),
        lastActiveAt: new Date(),
      },
    });

    return NextResponse.json({
      id: stream.id,
      name: stream.name,
      status: stream.status,
      updatedAt: stream.lastActiveAt,
    });
  } catch (error) {
    console.error('[API] Error updating stream:', error);
    return NextResponse.json(
      { error: 'Failed to update stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/streams/[id]
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;

    await db.videoStream.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Stream deleted successfully' });
  } catch (error) {
    console.error('[API] Error deleting stream:', error);
    return NextResponse.json(
      { error: 'Failed to delete stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
