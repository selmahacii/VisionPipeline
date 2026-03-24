/**
 * Data Drift Detection using PSI (Population Stability Index)
 * 
 * What is data drift?
 * When the statistical distribution of incoming data shifts away from
 * what the model was trained on. For CV models:
 * - Lighting conditions change (indoor → outdoor)
 * - Camera angle changes
 * - New object types appear that weren't in training data
 * - Image quality degrades (compression, blur)
 * 
 * How we detect it:
 * 1. Store a "reference" distribution of detection confidence scores
 *    from when the model was freshly deployed
 * 2. Periodically compute the current distribution
 * 3. Calculate PSI between reference and current
 * 4. PSI < 0.1: no drift, 0.1-0.2: slight drift, > 0.2: significant drift
 * 
 * PSI formula:
 * PSI = Σ (actual% - expected%) × ln(actual% / expected%)
 * 
 * When drift is detected:
 * - Log to DB + trigger alert via WebSocket
 * - If drift > retrain_threshold: trigger retraining pipeline
 */

import { config } from '../config';
import type { DriftReport } from '../types';

export class DriftDetector {
  private referenceSize: number;
  private currentSize: number;
  private referenceData: number[] = [];
  private currentData: number[] = [];
  private referenceSet = false;
  private streamId: string;

  constructor(streamId: string) {
    this.streamId = streamId;
    this.referenceSize = config.drift.referenceSize;
    this.currentSize = config.drift.currentSize;
  }

  /**
   * Add a new detection confidence to the rolling window
   */
  addDetection(confidence: number): void {
    if (!this.referenceSet) {
      // Building reference window
      this.referenceData.push(confidence);
      if (this.referenceData.length >= this.referenceSize) {
        this.referenceSet = true;
        console.log(`[DriftDetector] Reference window established for stream ${this.streamId}`);
      }
    } else {
      // Adding to current window
      this.currentData.push(confidence);
      if (this.currentData.length > this.currentSize) {
        this.currentData.shift(); // Remove oldest
      }
    }
  }

  /**
   * Compute PSI between reference and current distributions
   * Returns null if not enough data yet
   */
  computeDrift(): DriftReport | null {
    if (!this.referenceSet || this.currentData.length < 50) {
      return null;
    }

    const psi = this.calculatePSI(
      this.referenceData,
      this.currentData,
      10 // bins
    );

    const driftDetected = psi > config.drift.alertThreshold;

    let recommendation: DriftReport['recommendation'];
    if (psi < 0.10) {
      recommendation = 'no action';
    } else if (psi < 0.20) {
      recommendation = 'monitor closely';
    } else if (psi < 0.40) {
      recommendation = 'consider retraining';
    } else {
      recommendation = 'retrain immediately';
    }

    if (driftDetected) {
      console.warn(
        `[DriftDetector] Drift detected on stream ${this.streamId}: ` +
        `PSI=${psi.toFixed(4)} — ${recommendation}`
      );
    }

    return {
      streamId: this.streamId,
      driftScore: Math.round(psi * 10000) / 10000,
      driftDetected,
      nReference: this.referenceData.length,
      nCurrent: this.currentData.length,
      featureDrifts: { confidence: Math.round(psi * 10000) / 10000 },
      recommendation,
    };
  }

  /**
   * Reset reference after retraining
   * Current data becomes the new reference
   */
  resetReference(): void {
    if (this.currentData.length > 0) {
      this.referenceData = [...this.currentData];
      this.currentData = [];
      console.log(`[DriftDetector] Reference reset after retraining for stream ${this.streamId}`);
    }
  }

  /**
   * Calculate Population Stability Index (PSI)
   * PSI = Σ (actual - expected) × ln(actual / expected)
   */
  private calculatePSI(
    reference: number[],
    current: number[],
    bins: number = 10,
    eps: number = 1e-4
  ): number {
    // Create histogram bins based on reference distribution
    const sortedRef = [...reference].sort((a, b) => a - b);
    const binEdges: number[] = [];
    
    for (let i = 0; i <= bins; i++) {
      const idx = Math.floor((i / bins) * (sortedRef.length - 1));
      binEdges.push(sortedRef[idx]);
    }
    // Ensure edges cover full range
    binEdges[0] = 0;
    binEdges[bins] = 1;

    // Count values in each bin
    const refCounts = new Array(bins).fill(0);
    const curCounts = new Array(bins).fill(0);

    for (const val of reference) {
      for (let i = 0; i < bins; i++) {
        if (val >= binEdges[i] && val < binEdges[i + 1]) {
          refCounts[i]++;
          break;
        }
      }
    }

    for (const val of current) {
      for (let i = 0; i < bins; i++) {
        if (val >= binEdges[i] && val < binEdges[i + 1]) {
          curCounts[i]++;
          break;
        }
      }
    }

    // Calculate percentages
    const refPct = refCounts.map(c => Math.max(c / (reference.length + eps), eps));
    const curPct = curCounts.map(c => Math.max(c / (current.length + eps), eps));

    // Calculate PSI
    let psi = 0;
    for (let i = 0; i < bins; i++) {
      const expected = refPct[i];
      const actual = curPct[i];
      if (expected > 0 && actual > 0) {
        psi += (actual - expected) * Math.log(actual / expected);
      }
    }

    return Math.max(0, psi);
  }

  /**
   * Get current statistics
   */
  getStats(): { referenceMean: number; currentMean: number; referenceSet: boolean } {
    const referenceMean = this.referenceData.length > 0
      ? this.referenceData.reduce((a, b) => a + b, 0) / this.referenceData.length
      : 0;
    const currentMean = this.currentData.length > 0
      ? this.currentData.reduce((a, b) => a + b, 0) / this.currentData.length
      : 0;
    
    return {
      referenceMean,
      currentMean,
      referenceSet: this.referenceSet,
    };
  }
}

// Global drift detectors per stream
const driftDetectors = new Map<string, DriftDetector>();

export function getDriftDetector(streamId: string): DriftDetector {
  if (!driftDetectors.has(streamId)) {
    driftDetectors.set(streamId, new DriftDetector(streamId));
  }
  return driftDetectors.get(streamId)!;
}
