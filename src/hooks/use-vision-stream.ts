/**
 * useVisionStream - Real-time Vision Pipeline Hook
 * 
 * Simulates real-time CV detection data for the dashboard.
 * In production, this would connect to the CV service WebSocket.
 * 
 * This provides a working demo of all MLOps features:
 * - Real-time detection visualization
 * - Drift monitoring
 * - Performance metrics
 * - Alert generation
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Types
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

interface DetectionHistoryPoint {
  time: string;
  count: number;
  timestamp: number;
}

interface UseVisionStreamReturn {
  isConnected: boolean;
  connectionError: string | null;
  latestDetections: Detection[];
  frameNumber: number;
  inferenceMs: number;
  fps: number;
  totalDetections: number;
  confidenceMean: number;
  driftScore: number;
  driftDetected: boolean;
  classCounts: Record<string, number>;
  detectionHistory: DetectionHistoryPoint[];
  latencyHistory: { time: string; latency: number }[];
  alerts: Array<{
    type: 'alert';
    alertType: string;
    streamId?: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    data: Record<string, unknown>;
  }>;
  reconnect: () => void;
  clearAlerts: () => void;
}

// Simulated class types with weights
const OBJECT_TYPES = [
  { classId: 0, className: 'person', weight: 0.4, color: '#aaff44' },
  { classId: 2, className: 'car', weight: 0.3, color: '#44aaff' },
  { classId: 7, className: 'truck', weight: 0.1, color: '#ff8844' },
  { classId: 1, className: 'bicycle', weight: 0.1, color: '#ff44aa' },
  { classId: 3, className: 'motorcycle', weight: 0.1, color: '#ffaa44' },
];

// Seeded random for consistent simulation
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function useVisionStream(): UseVisionStreamReturn {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [latestDetections, setLatestDetections] = useState<Detection[]>([]);
  const [frameNumber, setFrameNumber] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(15);
  const [fps, setFps] = useState(10);
  const [totalDetections, setTotalDetections] = useState(0);
  const [confidenceMean, setConfidenceMean] = useState(0.75);
  const [driftScore, setDriftScore] = useState(0);
  const [driftDetected, setDriftDetected] = useState(false);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [detectionHistory, setDetectionHistory] = useState<DetectionHistoryPoint[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<{ time: string; latency: number }[]>([]);
  const [alerts, setAlerts] = useState<Array<{
    type: 'alert';
    alertType: string;
    streamId?: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    data: Record<string, unknown>;
  }>>([]);

  const frameCountRef = useRef(0);
  const totalDetectionsRef = useRef(0);
  const confidenceSumRef = useRef(0);
  const confidenceCountRef = useRef(0);
  const classCountsRef = useRef<Record<string, number>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const driftAccumRef = useRef<number[]>([]);
  const lastAlertRef = useRef(0);

  const generateDetections = useCallback((frame: number): Detection[] => {
    const rand = seededRandom(frame);
    const numDetections = Math.floor(rand() * 9);
    const detections: Detection[] = [];

    for (let i = 0; i < numDetections; i++) {
      // Select object type
      const typeRand = rand();
      let cumulative = 0;
      let selectedType = OBJECT_TYPES[0];
      for (const type of OBJECT_TYPES) {
        cumulative += type.weight;
        if (typeRand <= cumulative) {
          selectedType = type;
          break;
        }
      }

      // Generate bounding box with motion
      const baseX = 100 + rand() * 400;
      const baseY = 100 + rand() * 200;
      const width = 80 + rand() * 120;
      const height = 120 + rand() * 180;
      const motionX = Math.sin(frame * 0.05 + i) * 20;
      const motionY = Math.cos(frame * 0.03 + i) * 10;

      const confidence = Math.min(0.98, 0.45 + rand() * 0.4);

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
  }, []);

  const reconnect = useCallback(() => {
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  useEffect(() => {
    let frame = 0;

    intervalRef.current = setInterval(() => {
      frame++;
      const detections = generateDetections(frame);
      const latency = 15 + Math.random() * 10;

      // Update detections
      setLatestDetections(detections);
      setFrameNumber(frame);
      setInferenceMs(Math.round(latency * 100) / 100);

      // Update counts
      frameCountRef.current++;
      totalDetectionsRef.current += detections.length;
      setTotalDetections(totalDetectionsRef.current);

      // Update confidence tracking
      for (const det of detections) {
        confidenceSumRef.current += det.confidence;
        confidenceCountRef.current++;
        classCountsRef.current[det.className] = (classCountsRef.current[det.className] || 0) + 1;
      }

      // Every second (10 frames), update metrics
      if (frame % 10 === 0) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;

        const avgConf = confidenceCountRef.current > 0
          ? confidenceSumRef.current / confidenceCountRef.current
          : 0;
        setConfidenceMean(Math.round(avgConf * 1000) / 1000);
        setClassCounts({ ...classCountsRef.current });

        // Update history
        const time = new Date().toLocaleTimeString();
        setDetectionHistory(prev => {
          const updated = [...prev, { time, count: detections.length, timestamp: Date.now() }];
          return updated.slice(-60);
        });

        setLatencyHistory(prev => {
          const updated = [...prev, { time, latency }];
          return updated.slice(-60);
        });

        // Simulate drift (slowly increasing PSI over time)
        const simulatedDrift = Math.min(0.5, (frame / 10000) * 0.5 + Math.random() * 0.02);
        driftAccumRef.current.push(simulatedDrift);
        if (driftAccumRef.current.length > 10) {
          driftAccumRef.current.shift();
        }
        const avgDrift = driftAccumRef.current.reduce((a, b) => a + b, 0) / driftAccumRef.current.length;
        setDriftScore(Math.round(avgDrift * 10000) / 10000);
        setDriftDetected(avgDrift > 0.2);

        // Generate drift alert if needed (every 30 seconds at most)
        if (avgDrift > 0.2 && frame - lastAlertRef.current > 300) {
          lastAlertRef.current = frame;
          const severity = avgDrift > 0.4 ? 'CRITICAL' : 'WARNING';
          const recommendation = avgDrift > 0.4 ? 'Retrain immediately' : 'Monitor closely';
          
          setAlerts(prev => [{
            type: 'alert',
            alertType: 'DRIFT_DETECTED',
            streamId: 'demo-1',
            severity,
            message: `Model drift detected: PSI=${avgDrift.toFixed(4)} - ${recommendation}`,
            data: { driftScore: avgDrift, recommendation },
          }, ...prev].slice(0, 50));
        }
      }
    }, 100); // 10fps

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [generateDetections]);

  return {
    isConnected,
    connectionError,
    latestDetections,
    frameNumber,
    inferenceMs,
    fps,
    totalDetections,
    confidenceMean,
    driftScore,
    driftDetected,
    classCounts,
    detectionHistory,
    latencyHistory,
    alerts,
    reconnect,
    clearAlerts,
  };
}
