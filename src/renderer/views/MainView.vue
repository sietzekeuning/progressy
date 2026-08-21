<template>
    <div class="main">
        <header class="bar">
            <span class="brand">Progressy</span>
            <span class="count">{{ countLabel }}</span>
        </header>

        <div class="list">
            <div ref="stackEl" class="stack">
                <div v-if="actions.length === 0" class="empty">
                    <p>Nothing running</p>
                    <small>Workflow runs show up here the moment they start</small>
                </div>

                <TransitionGroup v-else name="card" tag="div" class="cards" appear>
                    <div v-for="action in actions" :key="action.key" class="item">
                        <div class="item-inner">
                            <ActionCard :action="action" :now="now" @dismiss="dismiss" />
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import ActionCard from '../components/ActionCard.vue'

const WINDOW_WIDTH = 440
const BAR_HEIGHT = 38
const MIN_HEIGHT = 150
const MAX_HEIGHT = 820

const actions = ref<any[]>([])
const now = ref(Date.now())
const stackEl = ref<HTMLElement | null>(null)

let clockInterval: ReturnType<typeof setInterval> | null = null
let resizeObserver: ResizeObserver | null = null

const countLabel = computed(() => {
    if (actions.value.length === 0) {
        return 'idle'
    }
    const running = actions.value.filter((action) => action.state === 'running' || action.state === 'queued').length
    return running ? `${running} running` : `${actions.value.length} finished`
})

// Measure the real content instead of guessing per-card heights, so the window
// hugs whatever is in it.
function fitWindow() {
    nextTick(() => {
        if (!stackEl.value) {
            return
        }
        const content = Math.ceil(stackEl.value.getBoundingClientRect().height)
        const height = Math.max(MIN_HEIGHT, Math.min(BAR_HEIGHT + content + 8, MAX_HEIGHT))
        window.electronAPI.resizeWindow(WINDOW_WIDTH, height)
    })
}

function dismiss(key: string) {
    actions.value = actions.value.filter((action) => action.key !== key)
    window.electronAPI.dismissAction(key)
}

onMounted(async () => {
    actions.value = await window.electronAPI.getRunningActions()
    fitWindow()

    // Only tick while there is actually something to count.
    clockInterval = setInterval(() => {
        if (actions.value.length) {
            now.value = Date.now()
        }
    }, 500)

    window.electronAPI.onActionsUpdate((data) => {
        actions.value = data
        now.value = Date.now()
        fitWindow()
    })

    if (stackEl.value) {
        resizeObserver = new ResizeObserver(() => fitWindow())
        resizeObserver.observe(stackEl.value)
    }
})

onUnmounted(() => {
    if (clockInterval) {
        clearInterval(clockInterval)
    }
    resizeObserver?.disconnect()
})
</script>

<style scoped>
.main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #0d1117;
}

.bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    padding: 0 14px 0 78px; /* room for the traffic lights */
    border-bottom: 1px solid #21262d;
    -webkit-app-region: drag;
}

.brand {
    font-size: 12px;
    font-weight: 600;
    color: #e6edf3;
    letter-spacing: -0.01em;
}

.count {
    font-size: 11px;
    color: #7d8590;
}

.list {
    flex: 1;
    overflow-y: auto;
}

.stack {
    padding: 6px 0 2px;
}

.empty {
    padding: 34px 20px;
    text-align: center;
    color: #7d8590;
}

.empty p {
    margin: 0 0 4px;
    font-size: 13px;
    color: #adb6c0;
}

.empty small {
    font-size: 11px;
}

.item {
    display: grid;
    grid-template-rows: 1fr;
    transition:
        grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 260ms ease,
        transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
}

.item-inner {
    min-height: 0;
    overflow: hidden;
    padding: 5px 12px 5px;
}

.card-enter-from,
.card-leave-to {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateX(24px) scale(0.97);
}

.card-leave-active {
    transition:
        grid-template-rows 320ms cubic-bezier(0.4, 0, 1, 1) 60ms,
        opacity 220ms ease,
        transform 300ms cubic-bezier(0.4, 0, 1, 1);
}
</style>
