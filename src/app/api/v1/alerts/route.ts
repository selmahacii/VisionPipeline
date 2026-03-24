/**
 * Alerts API Route
 * 
 * GET  /api/v1/alerts - List alerts with filters
 * POST /api/v1/alerts - Create a new alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('streamId');
    const alertType = searchParams.get('type');
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (streamId) where.streamId = streamId;
    if (alertType) where.alertType = alertType;
    if (severity) where.severity = severity;
    if (acknowledged !== null) where.acknowledged = acknowledged === 'true';

    const [alerts, total] = await Promise.all([
      db.alert.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      db.alert.count({ where }),
    ]);

    // Get alert counts by type
    const alertCounts = await db.alert.groupBy({
      by: ['alertType', 'severity'],
      where: { acknowledged: false },
      _count: { alertType: true },
    });

    return NextResponse.json({
      data: alerts.map(a => ({
        id: a.id,
        streamId: a.streamId,
        alertType: a.alertType,
        severity: a.severity,
        message: a.message,
        metadata: JSON.parse(a.metadata || '{}'),
        acknowledged: a.acknowledged,
        createdAt: a.createdAt,
      })),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: alertCounts.map(c => ({
        type: c.alertType,
        severity: c.severity,
        count: c._count.alertType,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { streamId, alertType, severity, message, metadata } = body;

    if (!alertType || !message) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'alertType and message are required' },
        { status: 400 }
      );
    }

    const alert = await db.alert.create({
      data: {
        streamId,
        alertType: alertType as any,
        severity: severity as any || 'INFO',
        message,
        metadata: JSON.stringify(metadata || {}),
      },
    });

    return NextResponse.json({
      id: alert.id,
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
