<template>
    <article
        class="card"
        :class="[`is-${action.state}`, { 'is-done': isDone, 'is-openable': !!action.url }]"
        role="link"
        :title="action.url ? 'Open this run on GitHub' : undefined"
        @click="open"
    >
        <span class="accent" aria-hidden="true"></span>

        <header class="card-head">
            <span class="glyph" aria-hidden="true">
                <span v-if="isRunning" class="spinner"></span>
                <span v-else class="dot"></span>
            </span>

            <h3 class="title" :title="action.repo">
                <span v-if="repoOwner" class="owner">{{ repoOwner }}/</span>{{ repoName }}
            </h3>

            <svg class="external" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M3.75 2h3a.75.75 0 0 1 0 1.5h-3a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3a.75.75 0 0 1 1.5 0v3A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.5 0h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V4.56L8.28 8.78a.75.75 0 0 1-1.06-1.06l4.22-4.22h-1.19a.75.75 0 0 1 0-1.5Z"
                />
            </svg>

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

        <p class="workflow">
            <svg class="workflow-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M0 1.75C0 .784.784 0 1.75 0h3.5C6.216 0 7 .784 7 1.75v3.5A1.75 1.75 0 0 1 5.25 7H4v4a1 1 0 0 0 1 1h4v-1.25C9 9.784 9.784 9 10.75 9h3.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0 1 14.25 16h-3.5A1.75 1.75 0 0 1 9 14.25v-.75H5A2.5 2.5 0 0 1 2.5 11V7h-.75A1.75 1.75 0 0 1 0 5.25Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Zm9 9a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Z"
                />
            </svg>
            <span class="workflow-name" :title="action.name">{{ action.name }}</span>
            <span v-if="action.branch" class="branch">{{ action.branch }}</span>
        </p>

        <p v-if="detailLine" class="detail" :title="detailLine">{{ detailLine }}</p>

        <div class="track" :class="{ indeterminate: isIndeterminate }">
            <div class="fill" :style="{ width: `${Math.round(progress * 100)}%` }"></div>
        </div>

        <footer class="meta">
            <span class="elapsed">{{ elapsedLabel }}</span>
            <span v-if="byLine" class="by">{{ byLine }}</span>
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

const emit = defineEmits<{
    (event: 'dismiss', key: string): void
    (event: 'open', url: string): void
}>()

function open() {
    if (props.action.url) {
        emit('open', props.action.url)
    }
}

// The repository is what you scan for first, so it leads the card. Its owner
// is nearly always the same across runs, so it is there but dimmed.
const repoOwner = computed(() => {
    const parts = String(props.action.repo || '').split('/')
    return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
})

const repoName = computed(() => {
    const parts = String(props.action.repo || '').split('/')
    return parts[parts.length - 1] || ''
})

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

// Prefer the time-based estimate (median of the last 3 successful runs) and
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

// Only worth the pixels when somebody else set it off.
const byLine = computed(() => (props.action.actor && !props.action.isMine ? `by ${props.action.actor}` : ''))

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
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.15s ease;
}

/* The whole card opens the run on GitHub. */
.card.is-openable {
    cursor: pointer;
}

.card.is-openable:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, rgba(255, 255, 255, 0.09));
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.08) inset,
        0 14px 34px -8px rgba(0, 0, 0, 0.75),
        0 2px 8px -2px rgba(0, 0, 0, 0.5);
}

.card.is-openable:active {
    transform: scale(0.994);
}

.external {
    flex: none;
    margin-left: -2px;
    color: #8b949e;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.card.is-openable:hover .external {
    opacity: 0.75;
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

.owner {
    font-weight: 500;
    color: #7d8590;
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

.workflow {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 5px 0 0;
    min-width: 0;
    font-size: 11px;
    color: #8b949e;
}

.workflow-icon {
    flex: none;
    opacity: 0.7;
}

.workflow-name {
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

.by {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #6e7681;
}

.right {
    margin-left: auto;
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
