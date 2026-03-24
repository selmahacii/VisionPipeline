<script setup lang="ts">
import { ref } from 'vue';
import LiveStream from './components/LiveStream.vue';
import { useVisionStream } from './composables/useVisionStream';

const selectedStreamId = ref('SIM-001');
const { detections, goldReport, isConnected, error } = useVisionStream(selectedStreamId.value);
</script>

<template>
  <div class="h-screen bg-black text-gray-100 flex flex-col font-sans">
    
    <!-- Navbar -->
    <header class="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-500/20 rounded-md border border-blue-500/30">
          <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div>
          <h1 class="text-sm font-bold tracking-tight uppercase">VisionPipeline</h1>
          <p class="text-[10px] text-gray-500 font-mono tracking-widest">PRO-GRADE MLOPS CORE</p>
        </div>
      </div>

      <nav class="flex items-center gap-6 text-xs font-medium text-gray-400">
        <a href="#" class="text-white">DASHBOARD</a>
        <a href="#" class="hover:text-white transition-colors">MODELS</a>
        <a href="#" class="hover:text-white transition-colors">LOGS</a>
        <a href="#" class="hover:text-white transition-colors">ALERTS</a>
      </nav>
      
      <div class="flex items-center gap-3">
        <div class="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
          <span class="text-[10px] font-bold">SH</span>
        </div>
      </div>
    </header>

    <!-- Main Grid -->
    <main class="flex-1 overflow-hidden p-6 grid grid-cols-12 gap-6 bg-gray-950">
      
      <!-- Primary Stream Column (8/12) -->
      <section class="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <div class="flex-1 min-h-0 bg-gray-900/40 rounded-xl border border-gray-800/60 p-4">
          <LiveStream 
            :stream-id="selectedStreamId" 
            :detections="detections"
            :is-connected="isConnected"
            :error="error"
          />
        </div>
      </section>

      <!-- Sidebar / Insights Column (4/12) -->
      <aside class="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2">
        
        <!-- PSI Drift Monitor Card -->
        <div class="p-6 bg-gray-900/60 rounded-xl border border-gray-800/80 shadow-lg">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Model Drift (PSI)</h3>
            <span 
              class="px-2 py-0.5 rounded text-[10px] font-bold"
              :class="goldReport?.drift_detected ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'"
            >
              {{ goldReport?.drift_detected ? 'CRITICAL' : 'STABLE' }}
            </span>
          </div>
          
          <div class="flex items-end gap-3 mb-2">
            <span class="text-5xl font-mono font-bold leading-none tracking-tighter">
              {{ goldReport?.psi_score.toFixed(3) || '0.000' }}
            </span>
          </div>
          
          <p class="text-xs text-gray-500 leading-relaxed">
            Status: <span class="text-gray-300">{{ goldReport?.recommendation || 'Analyzing stream...' }}</span>
          </p>

          <!-- Simple PSI Gauge Visualization -->
          <div class="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              class="h-full transition-all duration-500 ease-out"
              :class="goldReport?.drift_detected ? 'bg-red-500' : 'bg-green-500'"
              :style="{ width: `${Math.min((goldReport?.psi_score || 0) * 100, 100)}%` }"
            ></div>
          </div>
        </div>

        <!-- System Stats -->
        <div class="flex-1 bg-gray-900/40 rounded-xl border border-gray-800/40 border-dashed p-6">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Pipeline Health</h3>
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-gray-400 font-mono tracking-tighter">BRONZE_INGEST</span>
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                <span class="text-[10px] text-gray-300 font-bold">15 FPS</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-gray-400 font-mono tracking-tighter">SILVER_TRANSFORM</span>
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                <span class="text-[10px] text-gray-300 font-bold">ACTIVE</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-gray-400 font-mono tracking-tighter">GOLD_METRICS</span>
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                <span class="text-[10px] text-gray-300 font-bold">COMPUTING</span>
              </div>
            </div>
          </div>

          <!-- Technical Details Card -->
          <div class="mt-8 pt-6 border-t border-gray-800/60">
            <p class="text-[10px] text-gray-500 leading-tight mb-2">LAST_DRIVE_EVENT: {{ goldReport?.drift_detected ? 'CRITICAL_LOGGED' : 'AUTO_AUDIT' }}</p>
            <p class="text-[10px] text-gray-500 leading-tight font-mono">HASH: 49e8b_sim_active</p>
          </div>
        </div>

      </aside>
    </main>

    <!-- Footer Meta -->
    <footer class="h-8 bg-gray-900/80 border-t border-gray-800 flex items-center px-6 text-[10px] text-gray-600 font-mono gap-6">
      <span>VISION_PIPELINE v0.1.0</span>
      <span>ENGINE: PYTORCH/YOLOV8</span>
      <span>ENCRYPTION: AES-256</span>
      <span class="ml-auto">COPYRIGHT © 2025 SELMA HACI</span>
    </footer>

  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap');

html, body {
  background: black;
  scrollbar-width: thin;
  scrollbar-color: #1f2937 transparent;
}
</style>
