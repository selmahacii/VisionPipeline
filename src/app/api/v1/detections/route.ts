/**
 * Detections API Route
 * 
 * GET /api/v1/detections - Get paginated detections with filters
 * 
 * Supports filtering by:
 * - streamId: Filter by stream
 * - className: Filter by object class
 * - confidence: Minimum confidence threshold
 * - start/end: Time range filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('streamId');
    const className = searchParams.get('className');
    const minConfidence = searchParams.get('confidence');
    const startTime = searchParams.get('start');
    const endTime = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (streamId) where.streamId = streamId;
    if (className) where.className = className;
    if (minConfidence) where.confidence = { gte: parseFloat(minConfidence) };
    if (startTime || endTime) {
      where.detectedAt = {};
      if (startTime) where.detectedAt.gte = new Date(startTime);
      if (endTime) where.detectedAt.lte = new Date(endTime);
    }

    const [detections, total] = await Promise.all([
      db.detection.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { detectedAt: 'desc' },
      }),
      db.detection.count({ where }),
    ]);

    // Get class distribution for the query
    const classDistribution = await db.detection.groupBy({
      by: ['className'],
      where,
      _count: { className: true },
      orderBy: { _count: { className: 'desc' } },
      take: 10,
    });

    return NextResponse.json({
      data: detections.map(d => ({
        id: d.id,
        streamId: d.streamId,
        detectedAt: d.detectedAt,
        frameNumber: d.frameNumber,
        frameWidth: d.frameWidth,
        frameHeight: d.frameHeight,
        classId: d.classId,
        className: d.className,
        confidence: d.confidence,
        trackId: d.trackId,
        bbox: JSON.parse(d.bbox),
        attributes: JSON.parse(d.attributes || '{}'),
        tier: d.tier,
      })),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      aggregates: {
        classDistribution: classDistribution.map(c => ({
          className: c.className,
          count: c._count.className,
        })),
        avgConfidence: detections.length > 0
          ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
          : 0,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching detections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detections', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
