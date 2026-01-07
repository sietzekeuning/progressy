<template>
    <div class="main-container">
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
                    <div v-if="action.elapsedTime" class="elapsed-time">⏱ Running for {{ action.elapsedTime }}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" :style="{ width: `${action.progress || 0}%` }"></div>
                    </div>
                    <div class="progress-text">{{ Math.round(action.progress || 0) }}% complete</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const actions = ref<any[]>([])
let elapsedTimeInterval: NodeJS.Timeout | null = null

function updateElapsedTimes() {
    actions.value = actions.value.map((action) => {
        if (action.startedAt) {
            const startTime = new Date(action.startedAt).getTime()
            const now = Date.now()
            const elapsedMs = now - startTime
            const elapsedMinutes = Math.floor(elapsedMs / 60000)
            const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
            return {
                ...action,
                elapsedTime: `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds
                    .toString()
                    .padStart(2, '0')}`,
            }
        }
        return action
    })
}

onMounted(async () => {
    actions.value = await window.electronAPI.getRunningActions()
    updateElapsedTimes()

    // Update elapsed times every second
    elapsedTimeInterval = setInterval(updateElapsedTimes, 1000)

    window.electronAPI.onActionsUpdate((data) => {
        actions.value = data
        updateElapsedTimes()
    })

    window.electronAPI.onActionStarted(() => {
        // Refresh actions list
        window.electronAPI.getRunningActions().then((data) => {
            actions.value = data
            updateElapsedTimes()
        })
    })
})

onUnmounted(() => {
    if (elapsedTimeInterval) {
        clearInterval(elapsedTimeInterval)
    }
})
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
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #30363d;
}

h1 {
    color: #f0f6fc;
    font-size: 1.1rem;
}

.content {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
}

.empty-state {
    text-align: center;
    padding: 2rem 1rem;
    color: #8b949e;
}

.empty-state p {
    font-size: 1rem;
    margin-bottom: 0.25rem;
}

.empty-state small {
    font-size: 0.85rem;
}

.actions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.action-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 0.75rem;
}

.action-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
}

.action-header h3 {
    color: #f0f6fc;
    font-size: 0.9rem;
}

.repo-name {
    color: #8b949e;
    font-size: 0.8rem;
    margin-bottom: 0.25rem;
}

.current-job {
    color: #58a6ff;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    font-weight: 500;
}

.elapsed-time {
    color: #8b949e;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
}

.status-badge {
    padding: 0.2rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
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
    height: 6px;
    background: #21262d;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 0.25rem;
}

.progress-fill {
    height: 100%;
    background: #238636;
    transition: width 0.3s;
}

.progress-text {
    color: #8b949e;
    font-size: 0.75rem;
}
</style>
