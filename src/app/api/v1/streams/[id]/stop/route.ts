/**
 * Stream Stop API Route
 * 
 * POST /api/v1/streams/[id]/stop - Stop processing a video stream
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

    // Update stream status to INACTIVE
    const updatedStream = await db.videoStream.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
    });

    return NextResponse.json({
      message: 'Stream stopped',
      streamId: id,
      status: updatedStream.status,
    });
  } catch (error) {
    console.error('[API] Error stopping stream:', error);
    return NextResponse.json(
      { error: 'Failed to stop stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
