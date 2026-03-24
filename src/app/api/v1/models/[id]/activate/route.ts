/**
 * Model Activate API Route
 * 
 * POST /api/v1/models/[id]/activate - Activate a model version
 * 
 * This promotes the model to PRODUCTION stage and sets it as active.
 * All other models of the same name are deactivated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const model = await db.modelVersion.findUnique({
      where: { id },
    });

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found', message: `No model with id ${id}` },
        { status: 404 }
      );
    }

    // Deactivate all other models with the same name
    await db.modelVersion.updateMany({
      where: {
        name: model.name,
        id: { not: id },
      },
      data: { isActive: false },
    });

    // Activate this model and promote to PRODUCTION
    const activatedModel = await db.modelVersion.update({
      where: { id },
      data: {
        isActive: true,
        stage: 'PRODUCTION',
      },
    });

    return NextResponse.json({
      message: 'Model activated successfully',
      model: {
        id: activatedModel.id,
        name: activatedModel.name,
        version: activatedModel.version,
        stage: activatedModel.stage,
        isActive: activatedModel.isActive,
      },
    });
  } catch (error) {
    console.error('[API] Error activating model:', error);
    return NextResponse.json(
      { error: 'Failed to activate model', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
