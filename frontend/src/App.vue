<script setup lang="ts">
import { ref, computed } from 'vue';
import LiveStream from './components/LiveStream.vue';
import { useVisionStream } from './composables/useVisionStream';

const currentView = ref('dashboard');
const selectedStreamId = ref('SIM-001');
const { detections, goldReport, isConnected, error } = useVisionStream(selectedStreamId.value);

const avgConfidence = computed(() => {
  if (detections.value.length === 0) return 0;
  const sum = detections.value.reduce((acc, det) => acc + det.confidence, 0);
  return (sum / detections.value.length) * 100;
});

const activeObjects = computed(() => detections.value.length);
</script>

<template>
  <div class="h-screen bg-black text-gray-100 flex flex-col font-sans overflow-hidden">
    
    <!-- Navbar -->
    <header class="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md shrink-0">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-500/20 rounded-md border border-blue-500/30">
          <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div @click="currentView = 'dashboard'" class="cursor-pointer">
          <h1 class="text-sm font-bold tracking-tight uppercase">VisionPipeline</h1>
          <p class="text-[10px] text-gray-500 font-mono tracking-widest">PRO-GRADE MLOPS CORE</p>
        </div>
      </div>

      <nav class="flex items-center gap-6 text-xs font-medium text-gray-400">
        <button @click="currentView = 'dashboard'" :class="currentView === 'dashboard' ? 'text-white' : 'hover:text-white transition-colors'">DASHBOARD</button>
        <button @click="currentView = 'models'" :class="currentView === 'models' ? 'text-white' : 'hover:text-white transition-colors'">MODELS</button>
        <button @click="currentView = 'logs'" :class="currentView === 'logs' ? 'text-white' : 'hover:text-white transition-colors'">LOGS</button>
        <button @click="currentView = 'alerts'" :class="currentView === 'alerts' ? 'text-white' : 'hover:text-white transition-colors'">ALERTS</button>
      </nav>
      
      <div class="flex items-center gap-3">
        <div class="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
          <span class="text-[10px] font-bold">SH</span>
        </div>
      </div>
    </header>

    <!-- Content Router -->
    <main class="flex-1 overflow-auto bg-gray-950">
      
      <!-- DASHBOARD VIEW -->
      <div v-if="currentView === 'dashboard'" class="p-6 h-full grid grid-cols-12 gap-6">
        <!-- Primary Stream Column (8/12) -->
        <section class="col-span-12 lg:col-span-8 flex flex-col gap-6 min-h-[500px]">
          <div class="flex-1 bg-gray-900/40 rounded-xl border border-gray-800/60 p-4">
            <LiveStream 
              :stream-id="selectedStreamId" 
              :detections="detections"
              :is-connected="isConnected"
              :error="error"
            />
          </div>
        </section>

        <!-- Sidebar / Insights Column (4/12) -->
        <aside class="col-span-12 lg:col-span-4 flex flex-col gap-6">
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

            <div class="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                class="h-full transition-all duration-500 ease-out"
                :class="goldReport?.drift_detected ? 'bg-red-500' : 'bg-green-500'"
                :style="{ width: `${Math.min((goldReport?.psi_score || 0) * 100, 100)}%` }"
              ></div>
            </div>
          </div>

          <!-- Real-time Stats Grid -->
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-gray-900/40 rounded-xl border border-gray-800/60 transition-all hover:bg-gray-800/40">
              <p class="text-[10px] text-gray-500 uppercase font-mono mb-1">Active Tracks</p>
              <p class="text-2xl font-bold font-mono tracking-tighter">{{ activeObjects }}</p>
            </div>
            <div class="p-4 bg-gray-900/40 rounded-xl border border-gray-800/60 transition-all hover:bg-gray-800/40">
              <p class="text-[10px] text-gray-500 uppercase font-mono mb-1">Avg Confidence</p>
              <p class="text-2xl font-bold font-mono text-blue-400 tracking-tighter">{{ avgConfidence.toFixed(0) }}%</p>
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

            <div class="mt-8 pt-6 border-t border-gray-800/60">
              <p class="text-[10px] text-gray-500 leading-tight mb-2">LAST_DRIVE_EVENT: {{ goldReport?.drift_detected ? 'CRITICAL_LOGGED' : 'AUTO_AUDIT' }}</p>
              <p class="text-[10px] text-gray-500 leading-tight font-mono">HASH: 49e8b_sim_active</p>
            </div>
          </div>
        </aside>
      </div>

      <!-- MODELS VIEW -->
      <div v-else-if="currentView === 'models'" class="p-8">
        <h2 class="text-xl font-bold mb-6">Model Registry</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div v-for="m in ['YOLOv8-Nano-Baseline', 'YOLOv8-Small-Night']" :key="m" class="bg-gray-900 border border-gray-800 p-6 rounded-lg">
            <h4 class="text-blue-400 font-bold mb-2">{{ m }}</h4>
            <div class="text-xs text-gray-500 space-y-1">
              <p>PRECISION: 0.84 mAP</p>
              <p>STATUS: ACTIVE</p>
            </div>
          </div>
        </div>
      </div>

      <!-- LOGS VIEW -->
      <div v-else-if="currentView === 'logs'" class="p-8">
        <h2 class="text-xl font-bold mb-6">Pipeline Logs</h2>
        <div class="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden font-mono text-[10px]">
          <div v-for="l in 10" :key="l" class="p-2 border-b border-gray-800 hover:bg-gray-800/50">
            <span class="text-gray-500">[{{ new Date().toISOString() }}]</span>
            <span class="text-green-500 ml-4">INFO</span>
            <span class="ml-4">PROCESSED FRAME {{ 2400 + l }} | OBJECTS: 4 | PSI_LOK: OK</span>
          </div>
        </div>
      </div>

      <!-- ALERTS VIEW -->
      <div v-else-if="currentView === 'alerts'" class="p-8">
        <h2 class="text-xl font-bold mb-8 tracking-tight">Security & Quality Alerts</h2>
        <div class="space-y-4">
          <div v-if="goldReport?.drift_detected" class="p-6 bg-red-900/10 border border-red-500/30 rounded-xl flex items-center justify-between shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <div class="flex items-center gap-6">
              <div class="relative flex">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-8 w-8 bg-red-500 items-center justify-center">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
                </span>
              </div>
              <div>
                <p class="font-bold text-red-100 text-sm">CRITICAL_DATA_DRIFT</p>
                <p class="text-[10px] text-gray-500 uppercase font-mono mt-1">SIM-001 | PSI_SCORE: {{ goldReport?.psi_score.toFixed(4) }} | ACTION: RE-TRAIN</p>
              </div>
            </div>
            <button class="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg">RUN AUTO-RETRAIN</button>
          </div>
          <div class="p-12 text-center bg-gray-900/40 rounded-2xl border border-gray-800/80 border-dashed">
            <p class="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-mono">No other threats detected</p>
          </div>
        </div>
      </div>

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
