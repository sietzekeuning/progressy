<template>
  <div class="popup-container">
    <div class="popup-header">
      <h2>Running Actions</h2>
      <button class="close-btn" @click="handleClose">×</button>
    </div>

    <div class="popup-content">
      <div v-if="actions.length === 0" class="empty-state">
        <p>No running actions</p>
      </div>

      <div v-else class="actions-list">
        <div v-for="action in actions" :key="action.key" class="action-item">
          <div class="action-info">
            <div class="action-name">{{ action.name }}</div>
            <div class="repo-name">{{ action.repo }}</div>
            <div v-if="action.currentJob" class="current-job">
              Job: {{ action.currentJob }}
              <span v-if="action.currentStep"> → {{ action.currentStep }}</span>
            </div>
            <div v-if="action.elapsedTime" class="elapsed-time">
              ⏱ {{ action.elapsedTime }}
            </div>
          </div>
          <div class="progress-section">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${action.progress || 0}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ Math.round(action.progress || 0) }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const actions = ref<any[]>([]);
let elapsedTimeInterval: NodeJS.Timeout | null = null;

function updateElapsedTimes() {
  actions.value = actions.value.map((action) => {
    if (action.startedAt) {
      const startTime = new Date(action.startedAt).getTime();
      const now = Date.now();
      const elapsedMs = now - startTime;
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
      return {
        ...action,
        elapsedTime: `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds.toString().padStart(2, '0')}`,
      };
    }
    return action;
  });
}

onMounted(async () => {
  actions.value = await window.electronAPI.getRunningActions();
  updateElapsedTimes();

  // Update elapsed times every second
  elapsedTimeInterval = setInterval(updateElapsedTimes, 1000);

  window.electronAPI.onActionsUpdate((data) => {
    actions.value = data;
    updateElapsedTimes();
  });

  window.electronAPI.onActionStarted(() => {
    window.electronAPI.getRunningActions().then((data) => {
      actions.value = data;
      updateElapsedTimes();
    });
  });
});

onUnmounted(() => {
  if (elapsedTimeInterval) {
    clearInterval(elapsedTimeInterval);
  }
});

function handleClose() {
  window.electronAPI.closePopup();
}
</script>

<style scoped>
.popup-container {
  width: 100%;
  height: 100vh;
  background: #161b22;
  border: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #30363d;
  background: #0d1117;
  -webkit-app-region: drag;
}

.popup-header h2 {
  color: #f0f6fc;
  font-size: 1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #f0f6fc;
}

.popup-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #8b949e;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-item {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 1rem;
}

.action-info {
  margin-bottom: 0.75rem;
}

.action-name {
  color: #f0f6fc;
  font-size: 0.9rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.repo-name {
  color: #8b949e;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}

.current-job {
  color: #58a6ff;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  font-weight: 500;
}

.elapsed-time {
  color: #8b949e;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #21262d;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #238636;
  transition: width 0.3s;
}

.progress-text {
  color: #8b949e;
  font-size: 0.8rem;
  min-width: 40px;
  text-align: right;
}
</style>
