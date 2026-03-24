/**
 * Real-time Stream Processor — Core of the Data Pipeline
 * 
 * Data flow per frame:
 *   Raw frame (Bronze)
 *        ↓ YOLO detection
 *   Detections + metadata (Silver)
 *        ↓ DeepSORT tracking + aggregation
 *   Tracked objects + metrics (Gold)
 *        ↓ DB insert + WebSocket broadcast
 * 
 * Bronze layer: raw frame bytes, timestamp, stream metadata
 * Silver layer: cleaned detections with class names, confidence, bbox
 * Gold layer:   tracked objects, metrics aggregated by minute, anomalies
 * 
 * Why this layered architecture?
 * - Bronze: always reprocessable (raw data is the source of truth)
 * - Silver: cleaned, deduplicated, normalized — safe to query
 * - Gold: pre-aggregated for dashboards — fast to read, cheap to serve
 * 
 * This mirrors the Databricks Delta Lake / Medallion architecture
 * used at scale in production data engineering.
 */

import { config } from '../config';
import { getDetector } from '../cv/detector';
import { getDriftDetector } from '../mlops/drift-detector';
import type { Detection, SilverFrame, GoldMetrics, FrameResult } from '../types';

// Callback types
type SilverCallback = (frame: SilverFrame) => void | Promise<void>;
type GoldCallback = (metrics: GoldMetrics) => void | Promise<void>;
type AlertCallback = (type: string, data: Record<string, unknown>) => void | Promise<void>;

// Accumulators for Gold layer aggregation
interface MetricsAccumulator {
  frameCount: number;
  totalDetections: number;
  latencies: number[];
  confidences: number[];
  classCounts: Record<string, number>;
  trackIds: Set<number>;
  startTime: Date;
}

export class StreamProcessor {
  private streamId: string;
  private source: string;
  private running: boolean = false;
  private frameNumber: number = 0;
  private detector: ReturnType<typeof getDetector>;
  private driftDetector: ReturnType<typeof getDriftDetector>;

  // Callbacks
  private silverCallbacks: SilverCallback[] = [];
  private goldCallbacks: GoldCallback[] = [];
  private alertCallbacks: AlertCallback[] = [];

  // Metrics accumulator (rolling window)
  private accumulator: MetricsAccumulator;

  // Processing interval
  private intervalId: NodeJS.Timeout | null = null;

  constructor(streamId: string, source: string) {
    this.streamId = streamId;
    this.source = source;
    this.detector = getDetector();
    this.driftDetector = getDriftDetector(streamId);
    this.accumulator = this.createAccumulator();
  }

  /**
   * Create a fresh metrics accumulator
   */
  private createAccumulator(): MetricsAccumulator {
    return {
      frameCount: 0,
      totalDetections: 0,
      latencies: [],
      confidences: [],
      classCounts: {},
      trackIds: new Set(),
      startTime: new Date(),
    };
  }

  /**
   * Register callbacks for pipeline events
   */
  onSilver(callback: SilverCallback): void {
    this.silverCallbacks.push(callback);
  }

  onGold(callback: GoldCallback): void {
    this.goldCallbacks.push(callback);
  }

  onAlert(callback: AlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Start processing the stream
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.accumulator = this.createAccumulator();
    console.log(`[StreamProcessor] Starting stream ${this.streamId}`);

    // Simulate frame processing at ~10fps (configurable)
    // In production, this would read from actual video source
    this.intervalId = setInterval(() => {
      this.processFrame();
    }, 100); // 10fps simulation
  }

  /**
   * Stop processing the stream
   */
  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log(`[StreamProcessor] Stopped stream ${this.streamId}`);
  }

  /**
   * Process a single frame through the Bronze → Silver → Gold pipeline
   */
  private async processFrame(): Promise<void> {
    if (!this.running) return;

    this.frameNumber++;
    const frameSkip = config.processing.frameSkip;

    // Skip frames for performance
    if (this.frameNumber % frameSkip !== 0) {
      return;
    }

    try {
      // === BRONZE LAYER ===
      // In production: Read raw frame from video source
      // For demo: Generate simulated frame data
      const bronzeFrame = {
        streamId: this.streamId,
        frameNumber: this.frameNumber,
        timestamp: new Date(),
        width: 640,
        height: 480,
        rawData: '', // Would be base64 encoded frame
      };

      // === SILVER LAYER ===
      // Run YOLO detection
      const frameResult = await this.detector.detect(
        bronzeFrame.rawData,
        bronzeFrame.frameNumber,
        bronzeFrame.streamId
      );

      // Apply DeepSORT tracking (simulated - track IDs are already in detections)
      const silverFrame = this.createSilverFrame(frameResult);

      // Update drift detector with confidence scores
      for (const det of silverFrame.detections) {
        this.driftDetector.addDetection(det.confidence);
      }

      // Emit Silver layer
      await this.emitSilver(silverFrame);

      // Update accumulator for Gold layer
      this.updateAccumulator(frameResult);

      // === GOLD LAYER ===
      // Compute and emit Gold metrics every 30 frames (~3 seconds at 10fps)
      if (this.accumulator.frameCount >= 30) {
        const goldMetrics = this.computeGoldMetrics();
        await this.emitGold(goldMetrics);

        // Check for drift
        const driftReport = this.driftDetector.computeDrift();
        if (driftReport && driftReport.driftDetected) {
          await this.emitAlert('drift_detected', {
            streamId: this.streamId,
            driftScore: driftReport.driftScore,
            recommendation: driftReport.recommendation,
          });
        }

        // Reset accumulator
        this.accumulator = this.createAccumulator();
      }

    } catch (error) {
      console.error(`[StreamProcessor] Error processing frame:`, error);
      await this.emitAlert('processing_error', {
        streamId: this.streamId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create Silver layer frame from detection result
   */
  private createSilverFrame(result: FrameResult): SilverFrame {
    // Filter by confidence threshold
    const detections = result.detections.filter(
      d => d.confidence >= config.processing.confidenceThreshold
    );

    // Add class names
    const enrichedDetections: Detection[] = detections.map(d => ({
      ...d,
      className: this.detector.getClassName(d.classId),
    }));

    return {
      streamId: this.streamId,
      frameNumber: result.frameNumber,
      timestamp: result.timestamp,
      width: result.frameWidth,
      height: result.frameHeight,
      detections: enrichedDetections,
      inferenceMs: result.inferenceMs,
      processedAt: new Date(),
    };
  }

  /**
   * Update metrics accumulator
   */
  private updateAccumulator(result: FrameResult): void {
    this.accumulator.frameCount++;
    this.accumulator.totalDetections += result.detections.length;
    this.accumulator.latencies.push(result.inferenceMs);

    for (const det of result.detections) {
      this.accumulator.confidences.push(det.confidence);
      this.accumulator.classCounts[det.className] = 
        (this.accumulator.classCounts[det.className] || 0) + 1;
      if (det.trackId) {
        this.accumulator.trackIds.add(det.trackId);
      }
    }
  }

  /**
   * Compute Gold layer metrics from accumulator
   */
  private computeGoldMetrics(): GoldMetrics {
    const latencies = this.accumulator.latencies;
    const confidences = this.accumulator.confidences;

    const latencyMean = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const confidenceMean = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    const confidenceStd = confidences.length > 0
      ? Math.sqrt(
          confidences.reduce((sum, c) => sum + Math.pow(c - confidenceMean, 2), 0) / confidences.length
        )
      : 0;

    const driftStats = this.driftDetector.getStats();
    const driftReport = this.driftDetector.computeDrift();

    return {
      streamId: this.streamId,
      windowStart: this.accumulator.startTime,
      windowEnd: new Date(),
      framesProcessed: this.accumulator.frameCount,
      totalDetections: this.accumulator.totalDetections,
      objectsPerFrame: this.accumulator.frameCount > 0
        ? this.accumulator.totalDetections / this.accumulator.frameCount
        : 0,
      confidenceMean: Math.round(confidenceMean * 1000) / 1000,
      confidenceStd: Math.round(confidenceStd * 1000) / 1000,
      inferenceLatencyMeanMs: Math.round(latencyMean * 100) / 100,
      classCounts: this.accumulator.classCounts,
      trackIdsActive: Array.from(this.accumulator.trackIds),
      driftScore: driftReport?.driftScore ?? 0,
    };
  }

  /**
   * Emit Silver frame to callbacks
   */
  private async emitSilver(frame: SilverFrame): Promise<void> {
    for (const callback of this.silverCallbacks) {
      try {
        await callback(frame);
      } catch (error) {
        console.error('[StreamProcessor] Silver callback error:', error);
      }
    }
  }

  /**
   * Emit Gold metrics to callbacks
   */
  private async emitGold(metrics: GoldMetrics): Promise<void> {
    for (const callback of this.goldCallbacks) {
      try {
        await callback(metrics);
      } catch (error) {
        console.error('[StreamProcessor] Gold callback error:', error);
      }
    }
  }

  /**
   * Emit alert to callbacks
   */
  private async emitAlert(type: string, data: Record<string, unknown>): Promise<void> {
    for (const callback of this.alertCallbacks) {
      try {
        await callback(type, data);
      } catch (error) {
        console.error('[StreamProcessor] Alert callback error:', error);
      }
    }
  }

  /**
   * Get current processor status
   */
  getStatus(): { running: boolean; frameNumber: number; streamId: string } {
    return {
      running: this.running,
      frameNumber: this.frameNumber,
      streamId: this.streamId,
    };
  }
}

// Global stream processors registry
const processors = new Map<string, StreamProcessor>();

export function getProcessor(streamId: string, source?: string): StreamProcessor {
  if (!processors.has(streamId)) {
    if (!source) {
      throw new Error(`No processor found for stream ${streamId} and no source provided`);
    }
    processors.set(streamId, new StreamProcessor(streamId, source));
  }
  return processors.get(streamId)!;
}

export function removeProcessor(streamId: string): void {
  const processor = processors.get(streamId);
  if (processor) {
    processor.stop();
    processors.delete(streamId);
  }
}

export function getAllProcessors(): Map<string, StreamProcessor> {
  return processors;
}
