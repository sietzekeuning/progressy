<template>
    <div class="popup">
        <Transition name="fade">
            <div v-if="actions.length > 1" class="clear-row">
                <button class="clear-all" @click="clearAll">Clear all {{ actions.length }}</button>
            </div>
        </Transition>

        <TransitionGroup
            appear
            name="card"
            tag="div"
            class="stack"
            @before-leave="leaving += 1"
            @after-leave="handleAfterLeave"
        >
            <div v-for="action in actions" :key="action.key" class="item">
                <div class="item-inner">
                    <ActionCard :action="action" :now="now" @dismiss="dismiss" @open="openRun" />
                </div>
            </div>
        </TransitionGroup>
    </div>
</template>

<script setup lang="ts">
import { nextTick, ref, onMounted, onUnmounted } from 'vue'
import ActionCard from '../components/ActionCard.vue'

const actions = ref<any[]>([])
const now = ref(Date.now())

let clockInterval: ReturnType<typeof setInterval> | null = null
let pointerInteractive = false

// How many cards are still animating out. The window may only disappear once
// this is back to zero, otherwise a dismissal cuts its own animation short.
const leaving = ref(0)

// The popup window is click-through by default so it never gets in the way.
// It only becomes interactive while the cursor is actually over a card.
function setPointerInteractive(interactive: boolean) {
    if (interactive === pointerInteractive) {
        return
    }
    pointerInteractive = interactive
    window.electronAPI.setPointerInteractive(interactive)
}

function handleMouseMove(event: MouseEvent) {
    const target = document.elementFromPoint(event.clientX, event.clientY)
    setPointerInteractive(!!target?.closest('.card, .clear-all'))
}

function handleMouseLeave() {
    setPointerInteractive(false)
}

function dismiss(key: string) {
    actions.value = actions.value.filter((action) => action.key !== key)
    setPointerInteractive(false)
    window.electronAPI.dismissAction(key)
}

// Clicking a card opens that run on GitHub. The main process only lets
// github.com URLs through, so a card can never send us anywhere else.
function openRun(url: string) {
    window.electronAPI.openGitHubUrl(url)
}

function clearAll() {
    actions.value = []
    setPointerInteractive(false)
    window.electronAPI.dismissAll()
}

// Only tell the main process to hide once the stack is empty *and* nothing is
// still animating out.
function maybeHide() {
    if (actions.value.length === 0 && leaving.value === 0) {
        setPointerInteractive(false)
        window.electronAPI.popupEmpty()
    }
}

function handleAfterLeave() {
    leaving.value = Math.max(0, leaving.value - 1)
    maybeHide()
}

onMounted(async () => {
    actions.value = await window.electronAPI.getRunningActions()

    // Only tick while there is something to count - the popup window stays
    // alive (hidden) between runs and background throttling is off.
    clockInterval = setInterval(() => {
        if (actions.value.length) {
            now.value = Date.now()
        }
    }, 500)

    window.electronAPI.onActionsUpdate((data) => {
        actions.value = data
        now.value = Date.now()

        // Wait a tick so any leave transitions this update starts have been
        // counted before deciding whether the window can go.
        if (data.length === 0) {
            nextTick(maybeHide)
        }
    })

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('blur', handleMouseLeave)
})

onUnmounted(() => {
    if (clockInterval) {
        clearInterval(clockInterval)
    }
    window.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseleave', handleMouseLeave)
    window.removeEventListener('blur', handleMouseLeave)
})
</script>

<style scoped>
.popup {
    width: 100%;
    height: 100vh;
    background: transparent;
    overflow: hidden;
}

/* Sits above the stack; only appears once there is more than one card. */
.clear-row {
    display: flex;
    justify-content: flex-end;
    padding: 8px 16px 0;
}

.clear-all {
    padding: 3px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(22, 27, 34, 0.9);
    color: #8b949e;
    font-size: 10.5px;
    font-weight: 500;
    cursor: pointer;
    opacity: 0.75;
    box-shadow: 0 6px 18px -6px rgba(0, 0, 0, 0.7);
    transition:
        opacity 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
}

.clear-all:hover {
    opacity: 1;
    color: #f0f6fc;
    border-color: rgba(255, 255, 255, 0.22);
}

.fade-enter-active,
.fade-leave-active {
    transition:
        opacity 240ms ease,
        transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

.stack {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: calc(100vh - 30px);
    padding-top: 10px;
    overflow: hidden;
}

/*
 * Each row animates its own height via grid-template-rows, so the cards below
 * slide up and down instead of jumping. The inner padding doubles as the gap
 * between cards and as breathing room for the card's shadow.
 */
.item {
    display: grid;
    grid-template-rows: 1fr;
    transition:
        grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 260ms ease,
        transform 420ms cubic-bezier(0.16, 1, 0.3, 1),
        filter 260ms ease;
}

.item-inner {
    min-height: 0;
    overflow: hidden;
    padding: 6px 16px 10px;
}

.card-enter-from {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateX(34px) scale(0.96);
    filter: blur(2px);
}

.card-leave-to {
    grid-template-rows: 0fr;
    opacity: 0;
    transform: translateX(34px) scale(0.96);
    filter: blur(2px);
}

.card-leave-active {
    transition:
        grid-template-rows 320ms cubic-bezier(0.4, 0, 1, 1) 60ms,
        opacity 220ms ease,
        transform 300ms cubic-bezier(0.4, 0, 1, 1),
        filter 220ms ease;
}
</style>
