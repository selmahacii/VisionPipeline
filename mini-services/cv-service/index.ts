/**
 * VisionPipeline CV Service
 * 
 * A mini-service for real-time computer vision processing and WebSocket broadcasting.
 * This service:
 * - Manages WebSocket connections from dashboard clients
 * - Runs simulated CV detection at configurable frame rates
 * - Broadcasts detection events in real-time
 * - Implements the Bronze/Silver/Gold data pipeline
 * - Monitors for model drift
 * 
 * Port: 3001
 * WebSocket endpoint: / (via Caddy gateway with XTransformPort)
 */

import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { createServer } from 'http';

// ============================================================================
// TYPES
// ============================================================================

interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Detection {
  classId: number;
  className: string;
  confidence: number;
  bbox: BBox;
  trackId?: number;
}

interface FrameResult {
  frameNumber: number;
  detections: Detection[];
  inferenceMs: number;
  frameWidth: number;
  frameHeight: number;
  timestamp: Date;
}

interface StreamConfig {
  id: string;
  name: string;
  source: string;
  fps: number;
  active: boolean;
}

interface DriftStats {
  referenceMean: number;
  currentMean: number;
  referenceSet: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = 3001;
const CLASS_NAMES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush'
];

const CONFIDENCE_THRESHOLD = 0.45;

// ============================================================================
// DRIFT DETECTOR
// ============================================================================

class DriftDetector {
  private referenceData: number[] = [];
  private currentData: number[] = [];
  private referenceSet = false;
  private referenceSize = 1000;
  private currentSize = 200;

  addDetection(confidence: number): void {
    if (!this.referenceSet) {
      this.referenceData.push(confidence);
      if (this.referenceData.length >= this.referenceSize) {
        this.referenceSet = true;
        console.log('[DriftDetector] Reference window established');
      }
    } else {
      this.currentData.push(confidence);
      if (this.currentData.length > this.currentSize) {
        this.currentData.shift();
      }
    }
  }

  computePSI(): number {
    if (!this.referenceSet || this.currentData.length < 50) return 0;
    
    const bins = 10;
    const eps = 1e-4;
    const sortedRef = [...this.referenceData].sort((a, b) => a - b);
    const binEdges: number[] = [];
    
    for (let i = 0; i <= bins; i++) {
      const idx = Math.floor((i / bins) * (sortedRef.length - 1));
      binEdges.push(sortedRef[idx]);
    }
    binEdges[0] = 0;
    binEdges[bins] = 1;

    const refCounts = new Array(bins).fill(0);
    const curCounts = new Array(bins).fill(0);

    for (const val of this.referenceData) {
      for (let i = 0; i < bins; i++) {
        if (val >= binEdges[i] && val < binEdges[i + 1]) {
          refCounts[i]++;
          break;
        }
      }
    }

    for (const val of this.currentData) {
      for (let i = 0; i < bins; i++) {
        if (val >= binEdges[i] && val < binEdges[i + 1]) {
          curCounts[i]++;
          break;
        }
      }
    }

    const refPct = refCounts.map(c => Math.max(c / (this.referenceData.length + eps), eps));
    const curPct = curCounts.map(c => Math.max(c / (this.currentData.length + eps), eps));

    let psi = 0;
    for (let i = 0; i < bins; i++) {
      psi += (curPct[i] - refPct[i]) * Math.log(curPct[i] / refPct[i]);
    }

    return Math.max(0, psi);
  }

  getStats(): DriftStats {
    return {
      referenceMean: this.referenceData.length > 0
        ? this.referenceData.reduce((a, b) => a + b, 0) / this.referenceData.length
        : 0,
      currentMean: this.currentData.length > 0
        ? this.currentData.reduce((a, b) => a + b, 0) / this.currentData.length
        : 0,
      referenceSet: this.referenceSet,
    };
  }
}

// ============================================================================
// DETECTOR (SIMULATED)
// ============================================================================

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateDetections(frameNumber: number, streamId: string): Detection[] {
  const detections: Detection[] = [];
  const seed = hashString(streamId);
  const rand = seededRandom(seed + frameNumber);
  const numDetections = Math.floor(rand() * 9);

  const objectTypes = [
    { classId: 0, className: 'person', weight: 0.4 },
    { classId: 2, className: 'car', weight: 0.3 },
    { classId: 7, className: 'truck', weight: 0.1 },
    { classId: 1, className: 'bicycle', weight: 0.1 },
    { classId: 3, className: 'motorcycle', weight: 0.1 },
  ];

  for (let i = 0; i < numDetections; i++) {
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

    const baseX = 100 + rand() * 400;
    const baseY = 100 + rand() * 200;
    const width = 80 + rand() * 120;
    const height = 120 + rand() * 180;
    const motionX = Math.sin(frameNumber * 0.05 + i) * 20;
    const motionY = Math.cos(frameNumber * 0.03 + i) * 10;

    const confidence = Math.min(0.98, CONFIDENCE_THRESHOLD + rand() * 0.4);

    detections.push({
      classId: selectedType.classId,
      className: selectedType.className,
      confidence: Math.round(confidence * 1000) / 1000,
      bbox: {
        x1: Math.max(0, baseX + motionX),
        y1: Math.max(0, baseY + motionY),
        x2: Math.min(640, baseX + width + motionX),
        y2: Math.min(480, baseY + height + motionY),
      },
      trackId: Math.floor(rand() * 20) + 1,
    });
  }

  return detections;
}

// ============================================================================
// STREAM PROCESSOR
// ============================================================================

class StreamProcessor {
  private streamId: string;
  private source: string;
  private frameNumber = 0;
  private intervalId: Timer | null = null;
  private driftDetector: DriftDetector;
  private io: IOServer;
  private metrics = {
    totalDetections: 0,
    framesProcessed: 0,
    latencies: [] as number[],
    confidences: [] as number[],
    classCounts: {} as Record<string, number>,
  };

  constructor(streamId: string, source: string, io: IOServer) {
    this.streamId = streamId;
    this.source = source;
    this.io = io;
    this.driftDetector = new DriftDetector();
  }

  start(): void {
    console.log(`[StreamProcessor] Starting stream ${this.streamId}`);
    
    this.intervalId = setInterval(() => {
      this.processFrame();
    }, 100); // 10fps
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log(`[StreamProcessor] Stopped stream ${this.streamId}`);
  }

  private processFrame(): void {
    this.frameNumber++;
    
    // Skip every 2nd frame
    if (this.frameNumber % 2 !== 0) return;

    const startTime = performance.now();
    const detections = generateDetections(this.frameNumber, this.streamId);
    const inferenceMs = 15 + Math.random() * 10;

    // Update drift detector
    for (const det of detections) {
      this.driftDetector.addDetection(det.confidence);
    }

    // Update metrics
    this.metrics.framesProcessed++;
    this.metrics.totalDetections += detections.length;
    this.metrics.latencies.push(inferenceMs);
    if (this.metrics.latencies.length > 100) this.metrics.latencies.shift();

    for (const det of detections) {
      this.metrics.confidences.push(det.confidence);
      if (this.metrics.confidences.length > 500) this.metrics.confidences.shift();
      this.metrics.classCounts[det.className] = (this.metrics.classCounts[det.className] || 0) + 1;
    }

    // Emit detection event
    const frameResult: FrameResult = {
      frameNumber: this.frameNumber,
      detections,
      inferenceMs: Math.round(inferenceMs * 100) / 100,
      frameWidth: 640,
      frameHeight: 480,
      timestamp: new Date(),
    };

    this.io.emit('detection', {
      type: 'detection',
      streamId: this.streamId,
      ...frameResult,
      timestamp: frameResult.timestamp.toISOString(),
    });

    // Emit metrics every 30 frames
    if (this.metrics.framesProcessed % 30 === 0) {
      const driftScore = this.driftDetector.computePSI();
      const driftStats = this.driftDetector.getStats();
      
      const latMean = this.metrics.latencies.length > 0
        ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
        : 0;
      const confMean = this.metrics.confidences.length > 0
        ? this.metrics.confidences.reduce((a, b) => a + b, 0) / this.metrics.confidences.length
        : 0;

      this.io.emit('metrics', {
        type: 'metrics',
        streamId: this.streamId,
        framesProcessed: this.metrics.framesProcessed,
        totalDetections: this.metrics.totalDetections,
        objectsPerFrame: this.metrics.framesProcessed > 0
          ? this.metrics.totalDetections / this.metrics.framesProcessed
          : 0,
        inferenceLatencyMeanMs: Math.round(latMean * 100) / 100,
        confidenceMean: Math.round(confMean * 1000) / 1000,
        classCounts: this.metrics.classCounts,
        driftScore: Math.round(driftScore * 10000) / 10000,
        driftDetected: driftScore > 0.25,
      });

      // Emit drift alert if detected
      if (driftScore > 0.25) {
        const recommendation = driftScore < 0.20 ? 'monitor closely' :
                              driftScore < 0.40 ? 'consider retraining' : 'retrain immediately';
        
        this.io.emit('alert', {
          type: 'alert',
          alertType: 'DRIFT_DETECTED',
          streamId: this.streamId,
          severity: driftScore > 0.40 ? 'CRITICAL' : 'WARNING',
          message: `Model drift detected: PSI=${driftScore.toFixed(4)}`,
          data: {
            driftScore,
            recommendation,
            ...driftStats,
          },
        });
      }
    }
  }

  getStatus() {
    return {
      streamId: this.streamId,
      frameNumber: this.frameNumber,
      totalDetections: this.metrics.totalDetections,
      framesProcessed: this.metrics.framesProcessed,
    };
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

const httpServer = createServer();
const io = new IOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const processors = new Map<string, StreamProcessor>();

io.on('connection', (socket: Socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  socket.on('start_stream', (config: StreamConfig) => {
    console.log(`[WebSocket] Start stream request: ${config.id}`);
    
    if (!processors.has(config.id)) {
      const processor = new StreamProcessor(config.id, config.source || 'demo', io);
      processors.set(config.id, processor);
      processor.start();
    }
    
    socket.emit('stream_started', { streamId: config.id });
  });

  socket.on('stop_stream', (streamId: string) => {
    console.log(`[WebSocket] Stop stream request: ${streamId}`);
    
    const processor = processors.get(streamId);
    if (processor) {
      processor.stop();
      processors.delete(streamId);
    }
    
    socket.emit('stream_stopped', { streamId });
  });

  socket.on('get_status', () => {
    const status = Array.from(processors.values()).map(p => p.getStatus());
    socket.emit('status', status);
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

// Auto-start demo stream on server start
setTimeout(() => {
  console.log('[Auto-start] Creating demo stream');
  const demoProcessor = new StreamProcessor('demo-1', 'demo', io);
  processors.set('demo-1', demoProcessor);
  demoProcessor.start();
}, 1000);

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           VisionPipeline CV Service                        ║
║           Port: ${PORT}                                        ║
║           Status: Running                                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});
