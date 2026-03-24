/**
 * Models API Route
 * 
 * GET  /api/v1/models - List all model versions
 * POST /api/v1/models - Register a new model version
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const activeOnly = searchParams.get('active') === 'true';

    const where: any = {};
    if (stage) where.stage = stage;
    if (activeOnly) where.isActive = true;

    const models = await db.modelVersion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: models.map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        mlflowRunId: m.mlflowRunId,
        modelPath: m.modelPath,
        stage: m.stage,
        isActive: m.isActive,
        performance: {
          map50: m.map50,
          map75: m.map75,
        },
        trainingParams: JSON.parse(m.trainingParams || '{}'),
        datasetVersion: m.datasetVersion,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      activeModel: models.find(m => m.isActive) || null,
    });
  } catch (error) {
    console.error('[API] Error fetching models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, version, mlflowRunId, modelPath, map50, map75, trainingParams, datasetVersion } = body;

    if (!name || !version || !mlflowRunId) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'name, version, and mlflowRunId are required' },
        { status: 400 }
      );
    }

    const model = await db.modelVersion.create({
      data: {
        name,
        version,
        mlflowRunId,
        modelPath: modelPath || '',
        map50: map50 || 0,
        map75: map75 || 0,
        trainingParams: JSON.stringify(trainingParams || {}),
        datasetVersion,
        stage: 'DEVELOPMENT',
        isActive: false,
      },
    });

    return NextResponse.json({
      id: model.id,
      name: model.name,
      version: model.version,
      stage: model.stage,
      createdAt: model.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating model:', error);
    return NextResponse.json(
      { error: 'Failed to create model', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
