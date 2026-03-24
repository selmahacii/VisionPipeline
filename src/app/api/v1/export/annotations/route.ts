/**
 * Export API Route
 * 
 * GET /api/v1/export/annotations - Export detections in various formats
 * 
 * Supports:
 * - COCO JSON format (for ML training)
 * - CSV format (for analysis)
 * - YOLO format (for retraining)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'coco';
    const streamId = searchParams.get('streamId');
    const startTime = searchParams.get('start');
    const endTime = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '10000');

    // Build where clause
    const where: any = {};
    if (streamId) where.streamId = streamId;
    if (startTime || endTime) {
      where.detectedAt = {};
      if (startTime) where.detectedAt.gte = new Date(startTime);
      if (endTime) where.detectedAt.lte = new Date(endTime);
    }

    // Fetch detections
    const detections = await db.detection.findMany({
      where,
      take: limit,
      orderBy: { detectedAt: 'asc' },
    });

    if (format === 'coco') {
      return exportCOCO(detections);
    } else if (format === 'csv') {
      return exportCSV(detections);
    } else if (format === 'yolo') {
      return exportYOLO(detections);
    } else {
      return NextResponse.json(
        { error: 'Invalid format', message: 'Supported formats: coco, csv, yolo' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Export error:', error);
    return NextResponse.json(
      { error: 'Export failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Export in COCO JSON format
 */
function exportCOCO(detections: any[]) {
  const images: any[] = [];
  const annotations: any[] = [];
  const categories: Map<number, any> = new Map();
  
  let imageId = 0;
  let annotationId = 0;
  const imageMap: Map<string, number> = new Map();

  for (const det of detections) {
    // Create image entry
    const imageKey = `${det.streamId}-${det.frameNumber}`;
    let imgId: number;
    
    if (imageMap.has(imageKey)) {
      imgId = imageMap.get(imageKey)!;
    } else {
      imgId = ++imageId;
      imageMap.set(imageKey, imgId);
      images.push({
        id: imgId,
        file_name: `frame_${det.streamId}_${det.frameNumber}.jpg`,
        width: det.frameWidth,
        height: det.frameHeight,
      });
    }

    // Create annotation
    const bbox = JSON.parse(det.bbox);
    const width = bbox.x2 - bbox.x1;
    const height = bbox.y2 - bbox.y1;

    annotations.push({
      id: ++annotationId,
      image_id: imgId,
      category_id: det.classId,
      bbox: [bbox.x1, bbox.y1, width, height],
      area: width * height,
      iscrowd: 0,
      score: det.confidence,
    });

    // Track categories
    if (!categories.has(det.classId)) {
      categories.set(det.classId, {
        id: det.classId,
        name: det.className,
        supercategory: 'object',
      });
    }
  }

  const coco = {
    info: {
      description: 'VisionPipeline Detection Export',
      version: '1.0',
      year: new Date().getFullYear(),
      date_created: new Date().toISOString(),
    },
    licenses: [],
    images,
    annotations,
    categories: Array.from(categories.values()),
  };

  return NextResponse.json(coco, {
    headers: {
      'Content-Disposition': `attachment; filename="annotations_coco_${Date.now()}.json"`,
    },
  });
}

/**
 * Export in CSV format
 */
function exportCSV(detections: any[]) {
  const headers = [
    'id',
    'stream_id',
    'detected_at',
    'frame_number',
    'class_id',
    'class_name',
    'confidence',
    'track_id',
    'x1',
    'y1',
    'x2',
    'y2',
    'width',
    'height',
  ];

  const rows = detections.map(det => {
    const bbox = JSON.parse(det.bbox);
    return [
      det.id,
      det.streamId,
      det.detectedAt.toISOString(),
      det.frameNumber,
      det.classId,
      det.className,
      det.confidence,
      det.trackId || '',
      bbox.x1,
      bbox.y1,
      bbox.x2,
      bbox.y2,
      bbox.x2 - bbox.x1,
      bbox.y2 - bbox.y1,
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="detections_${Date.now()}.csv"`,
    },
  });
}

/**
 * Export in YOLO format
 */
function exportYOLO(detections: any[]) {
  // Group by frame
  const frameMap: Map<string, any[]> = new Map();
  
  for (const det of detections) {
    const key = `${det.streamId}-${det.frameNumber}`;
    if (!frameMap.has(key)) {
      frameMap.set(key, []);
    }
    frameMap.get(key)!.push(det);
  }

  const files: { filename: string; content: string }[] = [];

  for (const [key, frameDets] of frameMap) {
    const lines = frameDets.map(det => {
      const bbox = JSON.parse(det.bbox);
      // YOLO format: class x_center y_center width height (normalized 0-1)
      const xCenter = ((bbox.x1 + bbox.x2) / 2) / 640;
      const yCenter = ((bbox.y1 + bbox.y2) / 2) / 480;
      const width = (bbox.x2 - bbox.x1) / 640;
      const height = (bbox.y2 - bbox.y1) / 480;
      
      return `${det.classId} ${xCenter.toFixed(6)} ${yCenter.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
    });

    files.push({
      filename: `${key}.txt`,
      content: lines.join('\n'),
    });
  }

  return NextResponse.json({
    format: 'yolo',
    image_size: { width: 640, height: 480 },
    files,
    total_frames: files.length,
    total_detections: detections.length,
  });
}
