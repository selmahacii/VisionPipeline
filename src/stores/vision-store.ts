/**
 * Vision Pipeline Store
 * 
 * Global state management for the VisionPipeline platform using Zustand.
 * Manages streams, models, metrics, and UI state.
 */

import { create } from 'zustand';

// Types
export type StreamStatus = 'INACTIVE' | 'ACTIVE' | 'PROCESSING' | 'ERROR';
export type StreamSource = 'WEBCAM' | 'FILE' | 'RTSP' | 'HTTP';
export type ModelStage = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' | 'ARCHIVED';

export interface Stream {
  id: string;
  name: string;
  sourceType: StreamSource;
  sourceUri: string;
  status: StreamStatus;
  fpsActual: number;
  totalFrames: number;
  totalObjects: number;
  createdAt: string;
  lastActiveAt?: string;
}

export interface Model {
  id: string;
  name: string;
  version: string;
  stage: ModelStage;
  isActive: boolean;
  map50: number;
  map75: number;
  createdAt: string;
}

export interface AlertItem {
  id: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  streamId?: string;
  createdAt: string;
  acknowledged: boolean;
}

interface VisionStore {
  // Streams
  streams: Stream[];
  activeStreamId: string | null;
  setStreams: (streams: Stream[]) => void;
  addStream: (stream: Stream) => void;
  updateStream: (id: string, updates: Partial<Stream>) => void;
  setActiveStream: (id: string | null) => void;

  // Models
  models: Model[];
  activeModelId: string | null;
  setModels: (models: Model[]) => void;
  setActiveModel: (id: string) => void;

  // Alerts
  alerts: AlertItem[];
  setAlerts: (alerts: AlertItem[]) => void;
  addAlert: (alert: AlertItem) => void;
  acknowledgeAlert: (id: string) => void;

  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useVisionStore = create<VisionStore>((set) => ({
  // Streams
  streams: [],
  activeStreamId: null,
  setStreams: (streams) => set({ streams }),
  addStream: (stream) => set((state) => ({ streams: [stream, ...state.streams] })),
  updateStream: (id, updates) => set((state) => ({
    streams: state.streams.map((s) => s.id === id ? { ...s, ...updates } : s),
  })),
  setActiveStream: (id) => set({ activeStreamId: id }),

  // Models
  models: [],
  activeModelId: null,
  setModels: (models) => set({ 
    models,
    activeModelId: models.find(m => m.isActive)?.id || null,
  }),
  setActiveModel: (id) => set((state) => ({
    models: state.models.map((m) => ({
      ...m,
      isActive: m.id === id,
      stage: m.id === id ? 'PRODUCTION' : m.stage,
    })),
    activeModelId: id,
  })),

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 100) })),
  acknowledgeAlert: (id) => set((state) => ({
    alerts: state.alerts.map((a) => a.id === id ? { ...a, acknowledged: true } : a),
  })),

  // UI State
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // Loading states
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
