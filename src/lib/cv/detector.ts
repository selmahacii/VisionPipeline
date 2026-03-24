/**
 * YOLOv8 Object Detector Wrapper (TypeScript Implementation)
 * 
 * This module provides a simulated YOLOv8 detector for the VisionPipeline platform.
 * In production, this would interface with Python-based YOLOv8 via the mini-service.
 * 
 * Why YOLOv8?
 * - State of the art speed/accuracy trade-off in 2024-2025
 * - Supports detection, segmentation, pose estimation
 * - Easy fine-tuning on custom datasets
 * 
 * Architecture variants:
 * - YOLOv8n (nano): fastest, 3.2M params, ~80fps on CPU
 * - YOLOv8s (small): balanced, 11.2M params, ~50fps on CPU
 * - YOLOv8m (medium): accurate, 25.9M params, ~30fps on CPU
 */

import { config } from '../config';
import type { Detection, FrameResult, BBox } from '../types';

// Simulated detection generator for demo/testing
// In production, this calls the Python CV mini-service via HTTP

interface DetectorConfig {
  confidence: number;
  iouThreshold: number;
  modelVariant: 'n' | 's' | 'm' | 'l' | 'x';
}

export class YOLODetector {
  private confidence: number;
  private iouThreshold: number;
  private modelVariant: string;
  private classNames: string[];

  constructor(cfg: Partial<DetectorConfig> = {}) {
    this.confidence = cfg.confidence ?? config.processing.confidenceThreshold;
    this.iouThreshold = cfg.iouThreshold ?? config.processing.iouThreshold;
    this.modelVariant = cfg.modelVariant ?? 'n';
    this.classNames = config.model.classNames;
  }

  /**
   * Run detection on a frame (simulated)
   * In production, this sends the frame to the Python CV service
   */
  async detect(
    frameData: string, // Base64 encoded image
    frameNumber: number,
    streamId: string
  ): Promise<FrameResult> {
    const startTime = performance.now();

    // Simulate inference latency based on model variant
    // Real YOLOv8n: ~15ms, YOLOv8s: ~25ms, YOLOv8m: ~40ms
    const baseLatency = {
      n: 15,
      s: 25,
      m: 40,
      l: 60,
      x: 100,
    }[this.modelVariant] ?? 15;

    // Simulate variance in inference time
    const inferenceMs = baseLatency + Math.random() * 10;

    // Simulate async processing delay
    await new Promise(resolve => setTimeout(resolve, 5));

    // Generate simulated detections
    const detections = this.generateSimulatedDetections(frameNumber, streamId);

    const totalMs = performance.now() - startTime;

    return {
      frameNumber,
      detections,
      inferenceMs: Math.round(inferenceMs * 100) / 100,
      frameWidth: 640,
      frameHeight: 480,
      timestamp: new Date(),
    };
  }

  /**
   * Generate simulated detections for demo purposes
   * Creates realistic-looking bounding boxes with consistent tracking
   */
  private generateSimulatedDetections(frameNumber: number, streamId: string): Detection[] {
    const detections: Detection[] = [];
    
    // Use streamId to seed consistent behavior per stream
    const seed = this.hashString(streamId);
    const rand = this.seededRandom(seed + frameNumber);
    
    // Randomly decide number of detections (0-8)
    const numDetections = Math.floor(rand() * 9);
    
    // Track objects across frames (simplified simulation)
    const objectTypes = [
      { classId: 0, className: 'person', weight: 0.4 },
      { classId: 2, className: 'car', weight: 0.3 },
      { classId: 7, className: 'truck', weight: 0.1 },
      { classId: 1, className: 'bicycle', weight: 0.1 },
      { classId: 3, className: 'motorcycle', weight: 0.1 },
    ];

    for (let i = 0; i < numDetections; i++) {
      // Select object type based on weights
      const typeRand = rand();
      let cumulative = 0;
      let selectedType = objectTypes[0];
      for (const type of objectTypes) {
        cumulative += type.weight;
        if (typeRand <= cumulative) {
          selectedType = type;
          break;
        }
      }

      // Generate bounding box with smooth motion simulation
      const baseX = 100 + (rand() * 400);
      const baseY = 100 + (rand() * 200);
      const width = 80 + (rand() * 120);
      const height = 120 + (rand() * 180);

      // Add motion based on frame number (simulating object movement)
      const motionX = Math.sin(frameNumber * 0.05 + i) * 20;
      const motionY = Math.cos(frameNumber * 0.03 + i) * 10;

      const bbox: BBox = {
        x1: Math.max(0, baseX + motionX),
        y1: Math.max(0, baseY + motionY),
        x2: Math.min(640, baseX + width + motionX),
        y2: Math.min(480, baseY + height + motionY),
      };

      // Confidence with slight variance
      const confidence = Math.min(0.98, this.confidence + rand() * 0.4);

      detections.push({
        classId: selectedType.classId,
        className: selectedType.className,
        confidence: Math.round(confidence * 1000) / 1000,
        bbox,
        trackId: Math.floor(rand() * 20) + 1, // Simulated track ID
      });
    }

    return detections;
  }

  /**
   * Seeded random number generator for consistent simulation
   */
  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Hash string to number for seeding
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get class name by ID
   */
  getClassName(classId: number): string {
    return this.classNames[classId] ?? `class_${classId}`;
  }
}

// Singleton instance
let detectorInstance: YOLODetector | null = null;

export function getDetector(cfg?: Partial<DetectorConfig>): YOLODetector {
  if (!detectorInstance) {
    detectorInstance = new YOLODetector(cfg);
  }
  return detectorInstance;
}
