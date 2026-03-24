/**
 * VisionPipeline Configuration
 * 
 * All configuration values with sensible defaults for the MLOps platform.
 * These settings control:
 * - Frame processing performance
 * - Detection thresholds
 * - Drift monitoring sensitivity
 * - Data pipeline retention
 */

export const config = {
  // App metadata
  app: {
    name: 'VisionPipeline',
    version: '1.0.0',
    description: 'Production-Grade Computer Vision MLOps Platform',
  },

  // Frame processing settings
  processing: {
    // Process every Nth frame (performance optimization)
    frameSkip: 2,
    // Minimum confidence to accept detection
    confidenceThreshold: 0.45,
    // IoU threshold for NMS
    iouThreshold: 0.45,
    // Maximum objects to track per stream
    maxTrackedObjects: 50,
    // Batch size for GPU inference
    batchSize: 4,
  },

  // Drift detection thresholds
  drift: {
    // PSI above this = drift alert (warning)
    alertThreshold: 0.25,
    // PSI above this = retrain trigger (critical)
    retrainThreshold: 0.40,
    // Reference window size for PSI calculation
    referenceSize: 1000,
    // Current window size for PSI comparison
    currentSize: 200,
  },

  // Model settings
  model: {
    // Default YOLO model variant
    defaultModel: 'yolov8n',
    // Model class names (COCO dataset)
    classNames: [
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
    ],
  },

  // WebSocket settings
  websocket: {
    // CV processing service port
    cvServicePort: 3001,
    // Reconnect interval (ms)
    reconnectInterval: 3000,
    // Heartbeat interval (ms)
    heartbeatInterval: 30000,
  },

  // Data retention (days)
  retention: {
    bronze: 7,   // Raw data
    silver: 30,  // Cleaned data
    gold: 90,    // Aggregated metrics
  },

  // API endpoints
  api: {
    baseUrl: '/api/v1',
    endpoints: {
      streams: '/streams',
      detections: '/detections',
      metrics: '/metrics',
      models: '/models',
      alerts: '/alerts',
      experiments: '/experiments',
    },
  },

  // UI settings
  ui: {
    // Class colors for bounding boxes (deterministic based on class name)
    classColors: {
      person: '#aaff44',
      car: '#44aaff',
      truck: '#ff8844',
      bicycle: '#ff44aa',
      motorcycle: '#ffaa44',
      bus: '#aa44ff',
      default: '#ffffff',
    },
    // Chart colors
    chartColors: {
      primary: '#10b981',
      secondary: '#3b82f6',
      warning: '#f59e0b',
      danger: '#ef4444',
      purple: '#8b5cf6',
    },
  },
} as const;

export type Config = typeof config;
