<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useVisionStream } from '../composables/useVisionStream';

const props = defineProps<{
  streamId: string;
  width?: number;
  height?: number;
}>();

const { detections, isConnected, error } = useVisionStream(props.streamId);
const canvas = ref<HTMLCanvasElement | null>(null);

// Render detections on canvas
const drawDetections = () => {
  const ctx = canvas.value?.getContext('2d');
  if (!ctx || !canvas.value) return;

  // Clear previous frame
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

  // Draw each detection box
  detections.value.forEach(det => {
    const [x1, y1, x2, y2] = det.bbox;
    const w = x2 - x1;
    const h = y2 - y1;

    // Box Style
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, w, h);

    // Label Style
    ctx.fillStyle = '#00FF00';
    ctx.font = '14px Inter, system-ui';
    const label = `${det.class_name} #${det.track_id} (${(det.confidence * 100).toFixed(0)}%)`;
    ctx.fillText(label, x1, y1 > 20 ? y1 - 5 : y1 + 15);
  });
};

// Update canvas whenever detections change
watch(() => detections.value, drawDetections, { deep: true });

</script>

<template>
  <div class="relative bg-black rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
    <!-- Stream Info Overlay -->
    <div class="absolute top-4 left-4 z-10 flex items-center gap-2">
      <div 
        class="w-3 h-3 rounded-full animate-pulse" 
        :class="isConnected ? 'bg-green-500' : 'bg-red-500'"
      ></div>
      <span class="text-white text-xs font-mono uppercase tracking-widest">
        {{ streamId }} / {{ isConnected ? 'Live' : 'Offline' }}
      </span>
    </div>

    <!-- Live Stream Canvas -->
    <div class="aspect-video relative">
      <div v-if="!isConnected" class="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
        <p class="text-gray-400 font-mono text-sm">Connecting to Vision Core...</p>
      </div>
      
      <canvas 
        ref="canvas" 
        :width="width || 640" 
        :height="height || 480" 
        class="w-full h-full object-contain"
      ></canvas>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="bg-red-900/20 p-2 text-center border-t border-red-900/50">
      <span class="text-red-400 text-xs">{{ error }}</span>
    </div>
  </div>
</template>

<style scoped>
canvas {
  image-rendering: pixelated;
}
</style>
