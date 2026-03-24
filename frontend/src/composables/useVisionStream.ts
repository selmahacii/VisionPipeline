import { ref, onMounted, onUnmounted } from 'vue';

export interface Detection {
  track_id: number;
  bbox: [number, number, number, number];
  class_name: string;
  confidence: number;
}

export interface GoldReport {
  psi_score: number;
  drift_detected: boolean;
  recommendation: string;
}

export function useVisionStream(streamId: string) {
  const detections = ref<Detection[]>([]);
  const goldReport = ref<GoldReport | null>(null);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  
  let socket: WebSocket | null = null;

  const connect = () => {
    const wsUrl = `${import.meta.env.VITE_WS_URL}/api/v1/ws/${streamId}`;
    
    try {
      socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        isConnected.value = true;
        error.value = null;
        console.log(`Connected to stream: ${streamId}`);
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        detections.value = data.detections || [];
        goldReport.value = data.gold || null;
      };
      
      socket.onclose = () => {
        isConnected.value = false;
        console.log(`Disconnected from stream: ${streamId}`);
      };
      
      socket.onerror = (err) => {
        error.value = "WebSocket error occurred.";
        console.error(err);
      };
      
    } catch (e) {
      error.value = "Failed to establish connection.";
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.close();
      socket = null;
    }
  };

  onMounted(() => {
    connect();
  });

  // CRITICAL: Cleanup connection when component is unmounted (AS REQUESTED)
  onUnmounted(() => {
    disconnect();
  });

  return {
    detections,
    goldReport,
    isConnected,
    error,
    reconnect: connect
  };
}
