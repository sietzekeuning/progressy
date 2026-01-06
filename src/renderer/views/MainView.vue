<template>
  <div class="main-container">
    <header class="header">
      <h1>GitHub Actions Monitor</h1>
      <button class="btn-secondary" @click="handleLogout">Disconnect</button>
    </header>

    <div class="content">
      <div v-if="actions.length === 0" class="empty-state">
        <p>No running actions</p>
        <small>Actions will appear here when they start</small>
      </div>

      <div v-else class="actions-list">
        <div v-for="action in actions" :key="action.key" class="action-card">
          <div class="action-header">
            <h3>{{ action.name }}</h3>
            <span class="status-badge" :class="action.status">
              {{ action.status }}
            </span>
          </div>
          <p class="repo-name">{{ action.repo }}</p>
          <div v-if="action.currentJob" class="current-job">
            <strong>Current Job:</strong> {{ action.currentJob }}
            <span v-if="action.currentStep"> → {{ action.currentStep }}</span>
          </div>
          <div v-if="action.elapsedTime" class="elapsed-time">
            ⏱ Running for {{ action.elapsedTime }}
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${action.progress || 0}%` }"
            ></div>
          </div>
          <div class="progress-text">
            {{ Math.round(action.progress || 0) }}% complete
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
    // Refresh actions list
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

async function handleLogout() {
  await window.electronAPI.setGitHubToken('');
  window.location.reload();
}
</script>

<style scoped>
.main-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0d1117;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #30363d;
}

h1 {
  color: #f0f6fc;
  font-size: 1.25rem;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #30363d;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #8b949e;
}

.empty-state p {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.empty-state small {
  font-size: 0.9rem;
}

.actions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 1.5rem;
}

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.action-header h3 {
  color: #f0f6fc;
  font-size: 1rem;
}

.repo-name {
  color: #8b949e;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.current-job {
  color: #58a6ff;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.elapsed-time {
  color: #8b949e;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.in_progress {
  background: #1f6feb;
  color: white;
}

.status-badge.queued {
  background: #8b949e;
  color: white;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #21262d;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: #238636;
  transition: width 0.3s;
}

.progress-text {
  color: #8b949e;
  font-size: 0.85rem;
}
</style>
