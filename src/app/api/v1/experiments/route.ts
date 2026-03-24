/**
 * Experiments API Route
 * 
 * GET  /api/v1/experiments - List all experiments
 * POST /api/v1/experiments - Create a new experiment
 * 
 * This provides MLflow-style experiment tracking capabilities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [experiments, total] = await Promise.all([
      db.experiment.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          runs: {
            take: 5,
            orderBy: { startTime: 'desc' },
          },
          _count: { select: { runs: true } },
        },
      }),
      db.experiment.count(),
    ]);

    return NextResponse.json({
      data: experiments.map(e => ({
        id: e.id,
        name: e.name,
        description: e.description,
        runCount: e._count.runs,
        latestRuns: e.runs.map(r => ({
          id: r.id,
          runId: r.runId,
          status: r.status,
          startTime: r.startTime,
          endTime: r.endTime,
          metrics: JSON.parse(r.metrics || '{}'),
        })),
        createdAt: e.createdAt,
      })),
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[API] Error fetching experiments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch experiments', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field', message: 'name is required' },
        { status: 400 }
      );
    }

    const experiment = await db.experiment.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json({
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      createdAt: experiment.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating experiment:', error);
    return NextResponse.json(
      { error: 'Failed to create experiment', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
