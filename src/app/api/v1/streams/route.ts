/**
 * Streams API Route
 * 
 * GET  /api/v1/streams - List all streams with status
 * POST /api/v1/streams - Register a new video stream source
 * 
 * The streams endpoint manages video input sources for the CV pipeline.
 * Sources can be: webcam, video file, RTSP URL, or HTTP stream.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/v1/streams - List all streams
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = status ? { status: status as any } : {};

    const [streams, total] = await Promise.all([
      db.videoStream.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { detections: true } },
        },
      }),
      db.videoStream.count({ where }),
    ]);

    return NextResponse.json({
      data: streams.map(s => ({
        id: s.id,
        name: s.name,
        sourceType: s.sourceType,
        sourceUri: s.sourceUri,
        status: s.status,
        activeModelId: s.activeModelId,
        fpsActual: s.fpsActual,
        totalFrames: s.totalFrames,
        totalObjects: s.totalObjects,
        config: JSON.parse(s.config || '{}'),
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        detectionCount: s._count.detections,
      })),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching streams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch streams', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/v1/streams - Create new stream
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, sourceType, sourceUri, config } = body;

    if (!name || !sourceType || !sourceUri) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'name, sourceType, and sourceUri are required' },
        { status: 400 }
      );
    }

    const validSourceTypes = ['WEBCAM', 'FILE', 'RTSP', 'HTTP'];
    if (!validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { error: 'Invalid source type', message: `sourceType must be one of: ${validSourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const stream = await db.videoStream.create({
      data: {
        name,
        sourceType: sourceType as any,
        sourceUri,
        config: JSON.stringify(config || {}),
        status: 'INACTIVE',
      },
    });

    return NextResponse.json({
      id: stream.id,
      name: stream.name,
      sourceType: stream.sourceType,
      sourceUri: stream.sourceUri,
      status: stream.status,
      config: JSON.parse(stream.config || '{}'),
      createdAt: stream.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating stream:', error);
    return NextResponse.json(
      { error: 'Failed to create stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
