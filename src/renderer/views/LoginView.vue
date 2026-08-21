<template>
    <div ref="rootEl" class="login">
        <div class="drag-bar"></div>

        <div class="mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="26" height="26">
                <path
                    fill="currentColor"
                    d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                />
            </svg>
        </div>

        <h1>Connect Progressy</h1>
        <p class="lead">It watches your workflow runs and shows a card the moment one starts.</p>

        <!-- Device flow: only offered when this build has an OAuth App id -->
        <template v-if="auth?.hasClientId && !device">
            <button class="primary" :disabled="busy" @click="beginDeviceLogin">
                {{ busy ? 'Contacting GitHub…' : 'Sign in with GitHub' }}
            </button>
            <button class="link" @click="showToken = !showToken">
                {{ showToken ? 'Hide token option' : 'Use a personal access token instead' }}
            </button>
        </template>

        <!-- Device flow in progress -->
        <div v-if="device" class="device">
            <p class="device-lead">Enter this code on GitHub:</p>
            <div class="code" @click="copyCode">{{ device.userCode }}</div>
            <p class="hint">
                {{ copied ? 'Copied.' : 'Click the code to copy it.' }}
                The browser should already be open on {{ device.verificationUri.replace('https://', '') }}.
            </p>
            <button class="link" @click="cancelDeviceLogin">Cancel</button>
        </div>

        <!-- Token route -->
        <div v-if="showToken && !device" class="token">
            <button class="primary" @click="openTokenPage">Create a token on GitHub</button>
            <p class="hint">
                Opens GitHub with <code>repo</code> and <code>workflow</code> already ticked. Pick an expiry, click
                <strong>Generate token</strong>, then copy it — Progressy picks it up from your clipboard by itself.
            </p>

            <div class="paste" :class="{ armed: pasted }">
                <input
                    v-model="token"
                    type="password"
                    spellcheck="false"
                    placeholder="…or paste it here"
                    @keyup.enter="connect"
                />
                <button class="go" :disabled="!token || busy" @click="connect">
                    {{ busy ? '…' : 'Connect' }}
                </button>
            </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="notice" class="notice">{{ notice }}</p>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const rootEl = ref<HTMLElement | null>(null)
const auth = ref<any>(null)
const device = ref<any>(null)
const token = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)
const copied = ref(false)
const pasted = ref(false)
const showToken = ref(true)

// IPC wraps a thrown error twice ("Error: Error invoking remote method ...:
// AuthError: ..."), which is not something to show a person.
function humanError(err: any): string {
    let message = String(err?.message || err).replace(/Error invoking remote method '[^']+':\s*/, '')

    while (/^\w*Error:\s*/.test(message)) {
        message = message.replace(/^\w*Error:\s*/, '')
    }

    return message
}

async function connect(candidate?: string) {
    const value = (candidate || token.value).trim()

    if (!value || busy.value) {
        return
    }

    busy.value = true
    error.value = ''

    try {
        const account = await window.electronAPI.submitToken(value)
        notice.value = `Signed in as ${account.login}.`
        window.location.reload()
    } catch (err: any) {
        error.value = humanError(err)
        busy.value = false
    }
}

async function beginDeviceLogin() {
    busy.value = true
    error.value = ''

    try {
        device.value = await window.electronAPI.startDeviceLogin()
        await window.electronAPI.openGitHubUrl(device.value.verificationUri)
        copyCode()
    } catch (err: any) {
        error.value = humanError(err)
    } finally {
        busy.value = false
    }
}

function cancelDeviceLogin() {
    window.electronAPI.cancelDeviceLogin()
    device.value = null
}

function copyCode() {
    if (!device.value) {
        return
    }
    navigator.clipboard.writeText(device.value.userCode).then(() => {
        copied.value = true
    })
}

function openTokenPage() {
    if (auth.value?.tokenUrl) {
        window.electronAPI.openGitHubUrl(auth.value.tokenUrl)
        notice.value = 'Waiting for you to copy the token…'
    }
}

let resizeObserver: ResizeObserver | null = null

function fitWindow() {
    if (!rootEl.value) {
        return
    }
    const height = Math.ceil(rootEl.value.getBoundingClientRect().height)
    window.electronAPI.resizeWindow(440, Math.max(300, Math.min(height, 700)))
}

onMounted(async () => {
    auth.value = await window.electronAPI.getAuthState()
    showToken.value = !auth.value.hasClientId

    // The main process watches the clipboard while this screen is open, so a
    // freshly copied token signs you in without any further clicking.
    window.electronAPI.watchClipboard(true)

    window.electronAPI.onClipboardToken((detected) => {
        if (busy.value) {
            return
        }
        token.value = detected
        pasted.value = true
        notice.value = 'Token found on your clipboard — connecting…'
        connect(detected)
    })

    window.electronAPI.onLoginComplete(() => {
        window.location.reload()
    })

    window.electronAPI.onLoginError((message) => {
        device.value = null
        error.value = message
    })

    if (rootEl.value) {
        resizeObserver = new ResizeObserver(() => fitWindow())
        resizeObserver.observe(rootEl.value)
    }
    fitWindow()
})

onUnmounted(() => {
    window.electronAPI.watchClipboard(false)
    resizeObserver?.disconnect()
})
</script>

<style scoped>
.login {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 52px 26px 30px;
    text-align: center;
    background: radial-gradient(120% 80% at 50% 0%, #161d27 0%, #0d1117 60%);
    color: #c9d1d9;
}

.drag-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 38px;
    -webkit-app-region: drag;
}

.mark {
    color: #f0f6fc;
    opacity: 0.9;
    margin-bottom: 14px;
}

h1 {
    font-size: 17px;
    font-weight: 600;
    color: #f0f6fc;
    letter-spacing: -0.01em;
}

.lead {
    margin: 6px 0 22px;
    font-size: 12.5px;
    line-height: 1.45;
    color: #8b949e;
    max-width: 300px;
}

.primary {
    width: 100%;
    max-width: 320px;
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 9px;
    background: linear-gradient(180deg, #2b3440, #212932);
    color: #f0f6fc;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
        background 0.15s ease,
        border-color 0.15s ease;
}

.primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #333d4a, #262f39);
    border-color: rgba(255, 255, 255, 0.2);
}

.primary:disabled {
    opacity: 0.6;
    cursor: default;
}

.link {
    margin-top: 12px;
    padding: 4px;
    border: none;
    background: none;
    color: #58a6ff;
    font-size: 11.5px;
    cursor: pointer;
}

.link:hover {
    text-decoration: underline;
}

.device {
    width: 100%;
    max-width: 320px;
}

.device-lead {
    font-size: 12px;
    color: #8b949e;
}

.code {
    margin: 10px 0 8px;
    padding: 12px;
    border: 1px dashed rgba(88, 166, 255, 0.5);
    border-radius: 10px;
    background: rgba(88, 166, 255, 0.08);
    color: #f0f6fc;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 22px;
    letter-spacing: 0.22em;
    cursor: pointer;
}

.token {
    width: 100%;
    max-width: 320px;
}

.hint {
    margin: 10px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #8b949e;
}

.hint code {
    padding: 1px 4px;
    border-radius: 4px;
    background: #21262d;
    font-size: 10.5px;
}

.paste {
    display: flex;
    gap: 6px;
    margin-top: 14px;
}

.paste input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid #30363d;
    border-radius: 8px;
    background: #0d1117;
    color: #c9d1d9;
    font-size: 12px;
    transition: border-color 0.2s;
}

.paste input:focus {
    outline: none;
    border-color: #58a6ff;
}

.paste.armed input {
    border-color: #2ea043;
}

.go {
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    background: #238636;
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.go:hover:not(:disabled) {
    background: #2ea043;
}

.go:disabled {
    opacity: 0.5;
    cursor: default;
}

.error,
.notice {
    margin-top: 16px;
    max-width: 320px;
    font-size: 11.5px;
    line-height: 1.45;
}

.error {
    color: #f85149;
}

.notice {
    color: #8b949e;
}
</style>
