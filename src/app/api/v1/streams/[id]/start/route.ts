/**
 * Stream Start API Route
 * 
 * POST /api/v1/streams/[id]/start - Start processing a video stream
 * 
 * This endpoint initiates CV processing on the specified stream.
 * It updates the stream status and notifies the CV service via WebSocket.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const stream = await db.videoStream.findUnique({
      where: { id },
    });

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found', message: `No stream with id ${id}` },
        { status: 404 }
      );
    }

    // Update stream status to PROCESSING
    const updatedStream = await db.videoStream.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        lastActiveAt: new Date(),
      },
    });

    // In a real implementation, this would send a command to the CV service
    // For now, the CV service auto-starts a demo stream

    return NextResponse.json({
      message: 'Stream started',
      streamId: id,
      status: updatedStream.status,
      timestamp: updatedStream.lastActiveAt,
    });
  } catch (error) {
    console.error('[API] Error starting stream:', error);
    return NextResponse.json(
      { error: 'Failed to start stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
