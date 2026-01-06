import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } from 'electron'
import * as path from 'path'
import * as http from 'http'
import * as url from 'url'
import * as crypto from 'crypto'
import AutoLaunch from 'auto-launch'
import Store from 'electron-store'
import { Octokit } from '@octokit/rest'

const store = new Store()

// GitHub OAuth configuration
// Users need to create a GitHub OAuth App at https://github.com/settings/developers
const GITHUB_CLIENT_ID = (store.get('githubClientId') as string) || 'Iv1.8a61f9b507ba53b0'
const GITHUB_CLIENT_SECRET = store.get('githubClientSecret') as string | undefined
const REDIRECT_URI = 'http://localhost:3000/callback'
const OAUTH_SCOPE = 'repo workflow'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let popupWindow: BrowserWindow | null = null
let oauthWindow: BrowserWindow | null = null
let oauthServer: http.Server | null = null
let oauthState: string | null = null
let octokit: Octokit | null = null
let actionCheckInterval: NodeJS.Timeout | null = null
let runningActions: Map<string, any> = new Map()
let lastJobDetailsFetch: Map<string, number> = new Map() // Track when we last fetched job details
const JOB_DETAILS_CACHE_MS = 30000 // Cache job details for 30 seconds

// Configure auto-launch (Windows only for now)
let autoLauncher: AutoLaunch | null = null
if (process.platform === 'win32') {
    autoLauncher = new AutoLaunch({
        name: 'Progressy',
        path: app.getPath('exe'),
    })

    // Enable auto-launch
    autoLauncher.enable().catch(console.error)
}

function createTray() {
    let icon = nativeImage.createEmpty()

    // On macOS, use template icons for menu bar (works with light/dark mode)
    if (process.platform === 'darwin') {
        // Try to load template icons (1x and 2x for retina)
        const templatePaths = [
            path.join(__dirname, '../assets/iconTemplate@2x.png'),
            path.join(__dirname, '../../src/assets/iconTemplate@2x.png'),
            path.join(process.resourcesPath || __dirname, 'assets/iconTemplate@2x.png'),
            path.join(__dirname, '../assets/iconTemplate.png'),
            path.join(__dirname, '../../src/assets/iconTemplate.png'),
            path.join(process.resourcesPath || __dirname, 'assets/iconTemplate.png'),
        ]

        for (const iconPath of templatePaths) {
            const testIcon = nativeImage.createFromPath(iconPath)
            if (!testIcon.isEmpty()) {
                icon = testIcon
                // Set as template image for macOS menu bar
                icon.setTemplateImage(true)
                break
            }
        }
    } else {
        // For Windows/Linux, try regular icon paths
        const iconPaths = [
            path.join(__dirname, '../assets/icon.png'),
            path.join(__dirname, '../../src/assets/icon.png'),
            path.join(process.resourcesPath || __dirname, 'assets/icon.png'),
        ]

        for (const iconPath of iconPaths) {
            const testIcon = nativeImage.createFromPath(iconPath)
            if (!testIcon.isEmpty()) {
                icon = testIcon
                break
            }
        }
    }

    // Fallback: create a simple visible icon if none found
    if (icon.isEmpty()) {
        const size = 22
        const iconBuffer = Buffer.alloc(size * size * 4)
        for (let i = 0; i < iconBuffer.length; i += 4) {
            iconBuffer[i] = 60
            iconBuffer[i + 1] = 60
            iconBuffer[i + 2] = 60
            iconBuffer[i + 3] = 255
        }
        icon = nativeImage.createFromBuffer(iconBuffer, { width: size, height: size })
        if (process.platform === 'darwin') {
            icon.setTemplateImage(true)
        }
    }

    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Window',
            click: () => {
                if (mainWindow) {
                    mainWindow.show()
                } else {
                    createMainWindow()
                }
            },
        },
        {
            label: 'Quit',
            click: () => {
                app.quit()
            },
        },
    ])

    tray.setToolTip('Progressy - GitHub Actions Monitor')
    tray.setContextMenu(contextMenu)
    tray.on('click', () => {
        const token = store.get('githubToken') as string | undefined
        if (!token) {
            // Start OAuth flow if no token
            startOAuthFlow()
        } else {
            if (mainWindow) {
                mainWindow.show()
            } else {
                createMainWindow()
            }
        }
    })
}

function startOAuthServer(): Promise<string> {
    return new Promise((resolve, reject) => {
        if (oauthServer) {
            oauthServer.close()
        }

        // Don't regenerate state here - it should be set before calling this function
        if (!oauthState) {
            oauthState = crypto.randomBytes(16).toString('hex')
        }

        oauthServer = http.createServer((req, res) => {
            if (!req.url) {
                res.writeHead(400)
                res.end('Bad Request')
                return
            }

            console.log('OAuth callback received:', req.url)
            const parsedUrl = url.parse(req.url, true)
            console.log('Parsed pathname:', parsedUrl.pathname)

            // Handle root path as well (in case GitHub redirects there)
            if (parsedUrl.pathname === '/callback' || parsedUrl.pathname === '/') {
                const code = parsedUrl.query.code as string
                const returnedState = parsedUrl.query.state as string

                if (!code) {
                    res.writeHead(400)
                    res.end('Missing authorization code')
                    reject(new Error('Missing authorization code'))
                    return
                }

                if (returnedState !== oauthState) {
                    res.writeHead(400)
                    res.end('Invalid state parameter')
                    reject(new Error('Invalid state parameter'))
                    return
                }

                // Exchange code for token
                exchangeCodeForToken(code)
                    .then((token) => {
                        res.writeHead(200, { 'Content-Type': 'text/html' })
                        res.end(`
              <html>
                <head><title>Authorization Successful</title></head>
                <body>
                  <h1>Authorization Successful!</h1>
                  <p>You can close this window and return to the app.</p>
                  <script>setTimeout(() => window.close(), 2000);</script>
                </body>
              </html>
            `)
                        resolve(token)
                        if (oauthServer) {
                            oauthServer.close()
                            oauthServer = null
                        }
                        if (oauthWindow) {
                            oauthWindow.close()
                            oauthWindow = null
                        }
                    })
                    .catch((error) => {
                        res.writeHead(500)
                        res.end(`Error: ${error.message}`)
                        reject(error)
                    })
            } else {
                // Log all requests for debugging
                console.log('404 for path:', parsedUrl.pathname)
                res.writeHead(404)
                res.end('Not Found - Expected /callback')
            }
        })

        oauthServer.listen(3000, () => {
            console.log('OAuth server listening on http://localhost:3000')
        })

        oauthServer.on('error', (error) => {
            reject(error)
        })
    })
}

async function exchangeCodeForToken(code: string): Promise<string> {
    const clientId = (store.get('githubClientId') as string) || GITHUB_CLIENT_ID
    const clientSecret = store.get('githubClientSecret') as string | undefined

    if (!clientSecret) {
        throw new Error('GitHub Client Secret not configured')
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
        }),
    })

    if (!response.ok) {
        throw new Error(`Failed to exchange code for token: ${response.statusText}`)
    }

    const data = (await response.json()) as {
        access_token?: string
        error?: string
        error_description?: string
    }

    if (data.error) {
        throw new Error(data.error_description || data.error)
    }

    const token = data.access_token
    if (!token) {
        throw new Error('No access token received')
    }

    // Store the token
    store.set('githubToken', token)
    octokit = new Octokit({ auth: token })
    startActionMonitoring()

    return token
}

function startOAuthFlow() {
    const clientId = (store.get('githubClientId') as string) || GITHUB_CLIENT_ID
    const clientSecret = store.get('githubClientSecret') as string | undefined

    if (!clientSecret) {
        // Show error message - user needs to set up OAuth app
        if (mainWindow) {
            mainWindow.show()
            mainWindow.webContents.send(
                'oauth-error',
                'Please configure GitHub OAuth credentials. Create an OAuth App at https://github.com/settings/developers and enter your Client ID and Client Secret.',
            )
        } else {
            createMainWindow()
            // Wait for window to be ready before sending message
            setTimeout(() => {
                if (mainWindow) {
                    mainWindow.webContents.send(
                        'oauth-error',
                        'Please configure GitHub OAuth credentials. Create an OAuth App at https://github.com/settings/developers and enter your Client ID and Client Secret.',
                    )
                }
            }, 1000)
        }
        return
    }

    // Generate state BEFORE starting server
    oauthState = crypto.randomBytes(16).toString('hex')
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI,
    )}&scope=${encodeURIComponent(OAUTH_SCOPE)}&state=${oauthState}`

    // Start server first, then open window
    startOAuthServer()
        .then(() => {
            // OAuth completed successfully
            if (mainWindow) {
                mainWindow.reload()
            }
        })
        .catch((error) => {
            console.error('OAuth server error:', error)
            if (mainWindow) {
                mainWindow.webContents.send('oauth-error', error.message)
            }
        })

    // Open OAuth window
    oauthWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: true,
    })

    oauthWindow.loadURL(authUrl)

    // Intercept navigation to catch the callback
    oauthWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = url.parse(navigationUrl, true)
        if (parsedUrl.hostname === 'localhost' && parsedUrl.port === '3000') {
            // Let the navigation proceed - our server will handle it
            console.log('Navigating to callback:', navigationUrl)
        }
    })

    oauthWindow.on('closed', () => {
        oauthWindow = null
        if (oauthServer) {
            oauthServer.close()
            oauthServer = null
        }
    })
}

function createMainWindow() {
    // Show dock icon when window is opened (macOS)
    if (process.platform === 'darwin') {
        app.dock.show()
    }

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,
    })

    // Check if we have a token, if not start OAuth flow
    const token = store.get('githubToken') as string | undefined
    if (!token) {
        startOAuthFlow()
    }

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173')
        mainWindow.webContents.openDevTools()
    } else {
        // Try multiple possible paths for the renderer
        const appPath = app.getAppPath()
        const possiblePaths = [
            path.join(appPath, 'dist/renderer/index.html'), // Most common case: running from project root
            path.join(__dirname, '../renderer/index.html'), // When __dirname is dist/main
            path.join(__dirname, 'renderer/index.html'), // When __dirname is dist
            path.join(appPath, 'renderer/index.html'), // Fallback
        ]

        // Try to load the first path that exists
        const fs = require('fs')
        let rendererPath = possiblePaths.find((p) => fs.existsSync(p))

        if (!rendererPath) {
            // Last resort: use the most likely path
            rendererPath = possiblePaths[0]
        }

        mainWindow.loadFile(rendererPath)
    }

    mainWindow.on('closed', () => {
        // Hide dock icon again when window is closed (macOS)
        if (process.platform === 'darwin') {
            app.dock.hide()
        }
        mainWindow = null
    })

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()
    })

    // Log any errors from the renderer
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed to load:', validatedURL, errorCode, errorDescription)
    })

    mainWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Renderer ${level}]:`, message)
    })
}

function createPopupWindow() {
    if (popupWindow) {
        return
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const popupWidth = 400
    const popupHeight = 300

    popupWindow = new BrowserWindow({
        width: popupWidth,
        height: popupHeight,
        x: width - popupWidth - 20,
        y: 20,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    if (process.env.NODE_ENV === 'development') {
        popupWindow.loadURL('http://localhost:5173/#popup')
    } else {
        const appPath = app.getAppPath()
        const possiblePaths = [
            path.join(appPath, 'dist/renderer/index.html'),
            path.join(__dirname, '../renderer/index.html'),
            path.join(__dirname, 'renderer/index.html'),
            path.join(appPath, 'renderer/index.html'),
        ]

        const fs = require('fs')
        const rendererPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0]

        popupWindow.loadFile(rendererPath)
        popupWindow.webContents.once('did-finish-load', () => {
            popupWindow?.webContents.executeJavaScript("window.location.hash = 'popup'")
        })
    }

    popupWindow.on('closed', () => {
        popupWindow = null
    })
}

function hidePopupWindow() {
    if (popupWindow) {
        popupWindow.close()
        popupWindow = null
    }
}

async function checkGitHubActions() {
    if (!octokit) {
        return
    }

    try {
        // Only get the most recently updated repos (limit to 20 most recent)
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
            per_page: 5,
            sort: 'updated',
            direction: 'desc',
        })

        const allActions: any[] = []

        // First pass: Check for running workflows without detailed info
        for (const repo of repos) {
            try {
                const { data: workflows } = await octokit.actions.listWorkflowRunsForRepo({
                    owner: repo.owner.login,
                    repo: repo.name,
                    per_page: 3, // Only check latest 5 runs
                })

                const runningWorkflows = workflows.workflow_runs.filter(
                    (run) => run.status === 'in_progress' || run.status === 'queued',
                )

                for (const run of runningWorkflows) {
                    const key = `${repo.full_name}-${run.id}`

                    if (!runningActions.has(key)) {
                        // New action started - create basic entry
                        runningActions.set(key, {
                            key,
                            repo: repo.full_name,
                            runId: run.id,
                            name: run.name,
                            status: run.status,
                            startedAt: run.created_at,
                            progress: 0,
                            owner: repo.owner.login,
                            repoName: repo.name,
                        })

                        createPopupWindow()

                        // Send update to popup window
                        if (popupWindow) {
                            popupWindow.webContents.send('action-started', {
                                repo: repo.full_name,
                                runId: run.id,
                                name: run.name,
                            })
                        }
                    }

                    allActions.push({
                        key,
                        repo: repo.full_name,
                        runId: run.id,
                        name: run.name,
                        status: run.status,
                        startedAt: run.created_at,
                    })
                }
            } catch (error) {
                console.error(`Error fetching workflows for ${repo.full_name}:`, error)
            }
        }

        // Second pass: Only fetch detailed info for actions we're tracking
        for (const [key, action] of runningActions.entries()) {
            // Only update if this action is still running
            const stillRunning = allActions.find((a) => a.key === key)
            if (!stillRunning) {
                continue
            }

            try {
                const { data: jobs } = await octokit.actions.listJobsForWorkflowRun({
                    owner: action.owner || action.repo.split('/')[0],
                    repo: action.repoName || action.repo.split('/')[1],
                    run_id: action.runId,
                })

                const totalJobs = jobs.jobs.length
                const completedJobs = jobs.jobs.filter((job) => job.status === 'completed').length
                const progress = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0

                // Find currently running job
                const runningJob = jobs.jobs.find((job) => job.status === 'in_progress' || job.status === 'queued')

                // Get detailed job information only if there's a running job
                // Cache job details to avoid excessive API calls
                let currentStep: string | null = null
                if (runningJob) {
                    const jobDetailsKey = `${key}-${runningJob.id}`
                    const lastFetch = lastJobDetailsFetch.get(jobDetailsKey) || 0
                    const now = Date.now()

                    // Only fetch if cache expired
                    if (now - lastFetch > JOB_DETAILS_CACHE_MS) {
                        try {
                            const { data: jobDetails } = await octokit.actions.getJobForWorkflowRun({
                                owner: action.owner || action.repo.split('/')[0],
                                repo: action.repoName || action.repo.split('/')[1],
                                job_id: runningJob.id,
                            })

                            // Find current step
                            const currentStepData = jobDetails.steps?.find(
                                (step: any) => step.status === 'in_progress' || step.status === 'queued',
                            )
                            if (currentStepData) {
                                currentStep = currentStepData.name || null
                            }
                            lastJobDetailsFetch.set(jobDetailsKey, now)
                        } catch (error) {
                            console.error(`Error fetching job details for ${runningJob.id}:`, error)
                        }
                    } else {
                        // Use cached step if available
                        currentStep = action.currentStep || null
                    }
                }

                // Calculate elapsed time
                const startTime = new Date(action.startedAt).getTime()
                const now = Date.now()
                const elapsedMs = now - startTime
                const elapsedMinutes = Math.floor(elapsedMs / 60000)
                const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
                const elapsedTime = `${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSeconds
                    .toString()
                    .padStart(2, '0')}`

                action.progress = progress
                action.currentJob = runningJob?.name || null
                action.currentStep = currentStep
                action.elapsedTime = elapsedTime
                action.jobs = jobs.jobs.map((job) => ({
                    name: job.name,
                    status: job.status,
                    conclusion: job.conclusion,
                    startedAt: job.started_at,
                    completedAt: job.completed_at,
                }))

                // Send update to popup window
                if (popupWindow) {
                    popupWindow.webContents.send('action-update', {
                        key,
                        ...action,
                    })
                }
            } catch (error) {
                console.error(`Error fetching jobs for ${action.repo}:`, error)
            }
        }

        // Remove completed actions
        const completedKeys: string[] = []
        for (const [key, action] of runningActions.entries()) {
            if (!allActions.find((a) => a.key === key)) {
                completedKeys.push(key)
            }
        }

        for (const key of completedKeys) {
            runningActions.delete(key)
            // Clean up job details cache for completed actions
            for (const cacheKey of lastJobDetailsFetch.keys()) {
                if (cacheKey.startsWith(key)) {
                    lastJobDetailsFetch.delete(cacheKey)
                }
            }
        }

        // Hide popup if no actions running
        if (runningActions.size === 0 && popupWindow) {
            setTimeout(() => {
                if (runningActions.size === 0) {
                    hidePopupWindow()
                }
            }, 2000)
        }

        // Send all actions to popup
        if (popupWindow && allActions.length > 0) {
            popupWindow.webContents.send('actions-update', Array.from(runningActions.values()))
        }
    } catch (error) {
        console.error('Error checking GitHub Actions:', error)
    }
}

function startActionMonitoring() {
    if (actionCheckInterval) {
        clearInterval(actionCheckInterval)
    }

    // Check every 15 seconds to stay well within the 5,000 requests/hour limit
    // With caching (30s cache for job details), this uses ~1,440-3,000 calls/hour
    actionCheckInterval = setInterval(checkGitHubActions, 15000)
    checkGitHubActions() // Initial check
}

function stopActionMonitoring() {
    if (actionCheckInterval) {
        clearInterval(actionCheckInterval)
        actionCheckInterval = null
    }
}

app.whenReady().then(() => {
    // Set dock icon on macOS using icons.icns
    if (process.platform === 'darwin') {
        const dockIconPaths = [
            path.join(__dirname, '../assets/icons.icns'),
            path.join(__dirname, '../../src/assets/icons.icns'),
            path.join(process.resourcesPath || __dirname, 'assets/icons.icns'),
        ]

        for (const iconPath of dockIconPaths) {
            const fs = require('fs')
            if (fs.existsSync(iconPath)) {
                app.dock.setIcon(iconPath)
                break
            }
        }

        // Hide dock icon initially (show only menu bar icon)
        app.dock.hide()
    }

    createTray()

    // Check if GitHub token exists
    const token = store.get('githubToken') as string | undefined
    if (token) {
        octokit = new Octokit({ auth: token })
        startActionMonitoring()
    }
})

app.on('window-all-closed', () => {
    // Don't quit when windows are closed, keep running in tray
    // On macOS, apps typically stay active even when all windows are closed
    if (process.platform !== 'darwin') {
        // On Windows/Linux, prevent default quit behavior
        // The app will stay running in the tray
    }
})

app.on('before-quit', () => {
    stopActionMonitoring()
})

// Expose API to renderer
ipcMain.handle('get-github-token', () => {
    return store.get('githubToken')
})

ipcMain.handle('set-github-token', (_event, token: string) => {
    store.set('githubToken', token)
    if (token) {
        octokit = new Octokit({ auth: token })
        startActionMonitoring()
    } else {
        octokit = null
        stopActionMonitoring()
    }
    return true
})

ipcMain.handle('get-running-actions', () => {
    return Array.from(runningActions.values())
})

ipcMain.handle('close-popup', () => {
    hidePopupWindow()
    return true
})

ipcMain.handle('set-github-oauth-credentials', (_event, clientId: string, clientSecret: string) => {
    store.set('githubClientId', clientId)
    store.set('githubClientSecret', clientSecret)
    return true
})

ipcMain.handle('get-github-oauth-credentials', () => {
    return {
        clientId: store.get('githubClientId') || GITHUB_CLIENT_ID,
        hasClientSecret: !!store.get('githubClientSecret'),
    }
})
