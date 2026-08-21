<template>
    <article class="card" :class="[`is-${action.state}`, { 'is-done': isDone }]">
        <span class="accent" aria-hidden="true"></span>

        <header class="card-head">
            <span class="glyph" aria-hidden="true">
                <span v-if="isRunning" class="spinner"></span>
                <span v-else class="dot"></span>
            </span>

            <h3 class="title" :title="action.name">{{ action.name }}</h3>

            <span class="pill">
                <span v-if="isRunning" class="pulse" aria-hidden="true"></span>
                {{ statusLabel }}
            </span>

            <button class="dismiss" type="button" title="Dismiss" @click.stop="$emit('dismiss', action.key)">
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                    <path
                        d="M2 2 L10 10 M10 2 L2 10"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                    />
                </svg>
            </button>
        </header>

        <p class="repo">
            <svg class="repo-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"
                />
            </svg>
            <span class="repo-name">{{ action.repo }}</span>
            <span v-if="action.branch" class="branch">{{ action.branch }}</span>
        </p>

        <p v-if="detailLine" class="detail" :title="detailLine">{{ detailLine }}</p>

        <div class="track" :class="{ indeterminate: isIndeterminate }">
            <div class="fill" :style="{ width: `${Math.round(progress * 100)}%` }"></div>
        </div>

        <footer class="meta">
            <span class="elapsed">{{ elapsedLabel }}</span>
            <span class="right">{{ rightLabel }}</span>
        </footer>

        <div v-if="isDone" class="linger" :style="{ transform: `scaleX(${lingerFraction})` }" aria-hidden="true"></div>
    </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    action: any
    now: number
}>()

defineEmits<{ (event: 'dismiss', key: string): void }>()

const STATUS_LABELS: Record<string, string> = {
    queued: 'Queued',
    running: 'Running',
    success: 'Passed',
    failure: 'Failed',
    cancelled: 'Cancelled',
    timed_out: 'Timed out',
    skipped: 'Skipped',
    action_required: 'Action needed',
    neutral: 'Finished',
}

const isRunning = computed(() => props.action.state === 'running' || props.action.state === 'queued')
const isDone = computed(() => !isRunning.value)
const statusLabel = computed(() => STATUS_LABELS[props.action.state] || props.action.state)

const elapsedMs = computed(() => {
    if (isDone.value && props.action.durationMs) {
        return props.action.durationMs
    }
    return Math.max(0, props.now - (props.action.startedAtMs || props.now))
})

const expectedMs = computed<number | null>(() => props.action.expectedDurationMs || null)
const isOverdue = computed(() => !!expectedMs.value && isRunning.value && elapsedMs.value > expectedMs.value)

// Prefer the time-based estimate (average of the last 3 successful runs) and
// fall back to how many jobs are done when there is no history yet.
const progress = computed(() => {
    if (isDone.value) {
        return 1
    }

    if (expectedMs.value) {
        // Ease out near the end so the bar never claims to be finished early.
        const raw = elapsedMs.value / expectedMs.value
        return raw >= 1 ? 0.97 : Math.min(0.97, raw)
    }

    if (props.action.jobsTotal > 0) {
        return Math.min(1, props.action.jobsCompleted / props.action.jobsTotal)
    }

    return 0
})

const isIndeterminate = computed(() => isRunning.value && !expectedMs.value && !props.action.jobsTotal)

const detailLine = computed(() => {
    if (isDone.value) {
        return null
    }
    if (!props.action.currentJob) {
        return props.action.state === 'queued' ? 'Waiting for a runner' : null
    }
    return props.action.currentStep
        ? `${props.action.currentJob} → ${props.action.currentStep}`
        : props.action.currentJob
})

function formatClock(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.round(ms / 1000))
    if (totalSeconds < 60) {
        return `${totalSeconds}s`
    }
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

const elapsedLabel = computed(() =>
    isDone.value ? `Took ${formatDuration(elapsedMs.value)}` : formatClock(elapsedMs.value),
)

const rightLabel = computed(() => {
    if (isDone.value) {
        return props.action.jobsTotal ? `${props.action.jobsTotal} jobs` : ''
    }

    const jobs = props.action.jobsTotal ? `${props.action.jobsCompleted}/${props.action.jobsTotal} jobs` : ''

    if (expectedMs.value) {
        const remaining = expectedMs.value - elapsedMs.value
        const eta = remaining > 0 ? `~${formatDuration(remaining)} left` : 'longer than usual'
        return jobs ? `${eta} · ${jobs}` : eta
    }

    return jobs
})

// Drains from 1 to 0 over the linger window, so it is obvious the card is
// about to leave on its own.
const lingerFraction = computed(() => {
    if (!isDone.value || !props.action.completedAtMs) {
        return 1
    }
    const linger = props.action.lingerMs || 20000
    const remaining = props.action.completedAtMs + linger - props.now
    return Math.max(0, Math.min(1, remaining / linger))
})
</script>

<style scoped>
.card {
    position: relative;
    overflow: hidden;
    padding: 12px 14px 11px 16px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: linear-gradient(180deg, rgba(32, 39, 49, 0.97) 0%, rgba(19, 24, 32, 0.97) 100%);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 10px 30px -8px rgba(0, 0, 0, 0.7),
        0 2px 8px -2px rgba(0, 0, 0, 0.5);
    color: #e6edf3;
    --accent: #4b93ff;
    --accent-soft: rgba(75, 147, 255, 0.16);
}

.card.is-queued {
    --accent: #d0a12c;
    --accent-soft: rgba(208, 161, 44, 0.16);
}
.card.is-success {
    --accent: #35b45f;
    --accent-soft: rgba(53, 180, 95, 0.16);
}
.card.is-failure,
.card.is-timed_out {
    --accent: #f2504a;
    --accent-soft: rgba(242, 80, 74, 0.16);
}
.card.is-cancelled,
.card.is-skipped,
.card.is-neutral {
    --accent: #7d8590;
    --accent-soft: rgba(125, 133, 144, 0.16);
}
.card.is-action_required {
    --accent: #e08b2c;
    --accent-soft: rgba(224, 139, 44, 0.16);
}

/* Left edge accent, doubles as the at-a-glance status colour */
.accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--accent);
    box-shadow: 0 0 12px 0 var(--accent);
    opacity: 0.9;
}

.card-head {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
}

.glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    flex: none;
}

.dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
}

.spinner {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1.5px solid var(--accent-soft);
    border-top-color: var(--accent);
    animation: spin 0.9s linear infinite;
}

.title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #f0f6fc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: none;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    background: var(--accent-soft);
    color: color-mix(in srgb, var(--accent) 82%, white);
    font-size: 10px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
}

.pulse {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 1.6s ease-in-out infinite;
}

.dismiss {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-right: -3px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #8b949e;
    cursor: pointer;
    opacity: 0.55;
    transition:
        opacity 0.15s ease,
        background 0.15s ease,
        color 0.15s ease;
}

.dismiss:hover {
    opacity: 1;
    color: #f0f6fc;
    background: rgba(255, 255, 255, 0.1);
}

.repo {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 5px 0 0;
    min-width: 0;
    font-size: 11px;
    color: #8b949e;
}

.repo-icon {
    flex: none;
    opacity: 0.7;
}

.repo-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.branch {
    flex: none;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 1px 6px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
    color: #a9b3bd;
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
}

.detail {
    margin: 6px 0 0;
    font-size: 11.5px;
    line-height: 1.35;
    color: #7fb4ff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.track {
    position: relative;
    height: 4px;
    margin-top: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
}

.fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 70%, black), var(--accent));
    box-shadow: 0 0 10px -1px var(--accent);
    transition: width 0.6s linear;
}

/* No history and no jobs yet: show motion instead of a lie */
.track.indeterminate .fill {
    width: 35% !important;
    animation: sweep 1.6s ease-in-out infinite;
}

.meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    font-size: 10.5px;
    color: #7d8590;
    font-variant-numeric: tabular-nums;
}

.elapsed {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    color: #9aa4ae;
}

.right {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Countdown to the automatic dismissal of a finished card */
.linger {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--accent);
    opacity: 0.5;
    transform-origin: left center;
    transition: transform 0.6s linear;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.35;
        transform: scale(0.75);
    }
}

@keyframes sweep {
    0% {
        transform: translateX(-110%);
    }
    100% {
        transform: translateX(310%);
    }
}
</style>
