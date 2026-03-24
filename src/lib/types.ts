/**
 * VisionPipeline Type Definitions
 * 
 * Core types for the MLOps platform including:
 * - Detection results from CV models
 * - Tracking data for multi-object tracking
 * - Metrics for monitoring
 * - Pipeline data tiers (Bronze/Silver/Gold)
 */

// ============================================================================
// BOUNDING BOX & DETECTION
// ============================================================================

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  classId: number;
  className: string;
  confidence: number;
  bbox: BBox;
  trackId?: number;
  mask?: number[][]; // Segmentation polygon
}

export interface FrameResult {
  frameNumber: number;
  detections: Detection[];
  inferenceMs: number;
  frameWidth: number;
  frameHeight: number;
  timestamp: Date;
}

// ============================================================================
// TRACKING
// ============================================================================

export interface TrackedObject {
  trackId: number;
  classId: number;
  className: string;
  confidence: number;
  bbox: BBox;
  age: number; // Frames since first detection
  hits: number; // Total confirmed detections
  isConfirmed: boolean;
}

// ============================================================================
// DATA PIPELINE TIERS
// ============================================================================

/**
 * Bronze Layer - Raw frame data
 * The source of truth for reprocessing
 */
export interface BronzeFrame {
  streamId: string;
  frameNumber: number;
  timestamp: Date;
  width: number;
  height: number;
  rawData: string; // Base64 encoded frame
}

/**
 * Silver Layer - Cleaned and validated detection data
 * Deduplicated, normalized, safe to query
 */
export interface SilverFrame {
  streamId: string;
  frameNumber: number;
  timestamp: Date;
  width: number;
  height: number;
  detections: Detection[];
  inferenceMs: number;
  processedAt: Date;
}

/**
 * Gold Layer - Aggregated metrics for dashboards
 * Pre-computed for fast reads
 */
export interface GoldMetrics {
  streamId: string;
  windowStart: Date;
  windowEnd: Date;
  framesProcessed: number;
  totalDetections: number;
  objectsPerFrame: number;
  confidenceMean: number;
  confidenceStd: number;
  inferenceLatencyMeanMs: number;
  classCounts: Record<string, number>;
  trackIdsActive: number[];
  driftScore: number;
}

// ============================================================================
// STREAM MANAGEMENT
// ============================================================================

export type StreamStatus = 'INACTIVE' | 'ACTIVE' | 'PROCESSING' | 'ERROR';
export type StreamSource = 'WEBCAM' | 'FILE' | 'RTSP' | 'HTTP';

export interface VideoStream {
  id: string;
  name: string;
  sourceType: StreamSource;
  sourceUri: string;
  status: StreamStatus;
  activeModelId?: string;
  fpsActual: number;
  totalFrames: number;
  totalObjects: number;
  config: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt?: Date;
}

export interface StreamCreateInput {
  name: string;
  sourceType: StreamSource;
  sourceUri: string;
  config?: Record<string, unknown>;
}

// ============================================================================
// MODEL MANAGEMENT
// ============================================================================

export type ModelStage = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'ARCHIVED';

export interface ModelVersion {
  id: string;
  name: string;
  version: string;
  mlflowRunId: string;
  modelPath: string;
  stage: ModelStage;
  isActive: boolean;
  map50: number;
  map75: number;
  trainingParams: Record<string, unknown>;
  datasetVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  runId: string;
  status: 'RUNNING' | 'FINISHED' | 'FAILED';
  startTime: Date;
  endTime?: Date;
  parameters: Record<string, unknown>;
  metrics: Record<string, number>;
  artifacts: Record<string, string>;
}

// ============================================================================
// DRIFT DETECTION
// ============================================================================

export interface DriftReport {
  streamId: string;
  driftScore: number; // PSI score
  driftDetected: boolean;
  nReference: number;
  nCurrent: number;
  featureDrifts: Record<string, number>;
  recommendation: 'no action' | 'monitor closely' | 'consider retraining' | 'retrain immediately';
}

// ============================================================================
// ALERTS
// ============================================================================

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType = 
  | 'DRIFT_DETECTED' 
  | 'MODEL_DEGRADED' 
  | 'STREAM_ERROR' 
  | 'RETRAIN_TRIGGERED' 
  | 'MODEL_DEPLOYED' 
  | 'THRESHOLD_EXCEEDED';

export interface Alert {
  id: string;
  streamId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: Date;
}

// ============================================================================
// WEBSOCKET MESSAGES
// ============================================================================

export interface WSDetectionMessage {
  type: 'detection';
  streamId: string;
  frameNumber: number;
  timestamp: string;
  detections: Detection[];
  inferenceMs: number;
}

export interface WSAlertMessage {
  type: 'alert';
  alertType: AlertType;
  streamId?: string;
  message: string;
  severity: AlertSeverity;
  data: Record<string, unknown>;
}

export interface WSDriftMessage {
  type: 'drift';
  streamId: string;
  driftScore: number;
  recommendation: string;
}

export interface WSStatusMessage {
  type: 'status';
  streamId: string;
  status: StreamStatus;
  fps: number;
  totalObjects: number;
}

export type WSMessage = WSDetectionMessage | WSAlertMessage | WSDriftMessage | WSStatusMessage;

// ============================================================================
// API RESPONSES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface APIError {
  error: string;
  message: string;
  statusCode: number;
}
