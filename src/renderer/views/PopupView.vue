<template>
    <div class="popup">
        <TransitionGroup appear name="card" tag="div" class="stack" @after-leave="handleAfterLeave">
            <div v-for="action in actions" :key="action.key" class="item">
                <div class="item-inner">
                    <ActionCard :action="action" :now="now" @dismiss="dismiss" />
                </div>
            </div>
        </TransitionGroup>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ActionCard from '../components/ActionCard.vue'

const actions = ref<any[]>([])
const now = ref(Date.now())

let clockInterval: ReturnType<typeof setInterval> | null = null
let pointerInteractive = false

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
    setPointerInteractive(!!target?.closest('.card'))
}

function handleMouseLeave() {
    setPointerInteractive(false)
}

function dismiss(key: string) {
    actions.value = actions.value.filter((action) => action.key !== key)
    setPointerInteractive(false)
    window.electronAPI.dismissAction(key)
}

// Only tell the main process to hide once the last card has finished
// animating out, otherwise the window would blink away mid-transition.
function handleAfterLeave() {
    if (actions.value.length === 0) {
        setPointerInteractive(false)
        window.electronAPI.popupEmpty()
    }
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
        const hadCards = actions.value.length > 0
        actions.value = data
        now.value = Date.now()

        // Nothing to animate out, so the window can go away right away.
        if (data.length === 0 && !hadCards) {
            window.electronAPI.popupEmpty()
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

.stack {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: 100vh;
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
