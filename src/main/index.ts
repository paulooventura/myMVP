import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import type { AppSettings, ChatMessage } from '../shared/types'
import { getSettings, saveSettings } from './config'
import {
  dismissUpdate,
  getQuestion,
  listQuestions,
  saveFromDigest,
  setLiveMonitor
} from './history'
import { recheckQuestion, restartLiveMonitor, startLiveMonitor } from './live-monitor'
import { providerStatuses } from './providers'
import { digest } from './orchestrator'
import { runAgent } from './agent'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: '#0b0f1a',
    titleBarStyle: 'default',
    title: 'myMVP',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  startLiveMonitor()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:save', (_e, partial: Partial<AppSettings>) => {
    const saved = saveSettings(partial)
    restartLiveMonitor()
    return saved
  })

  ipcMain.handle('providers:status', () => providerStatuses(getSettings()))

  ipcMain.handle('chat:digest', async (_e, history: ChatMessage[]) => {
    const settings = getSettings()
    const res = await digest(settings, history)
    const question =
      [...history].reverse().find((m) => m.role === 'user')?.content ?? ''
    if (question.trim()) {
      const saved = saveFromDigest(question, res, settings.liveMonitorEnabled)
      return { ...res, questionId: saved.id }
    }
    return res
  })

  ipcMain.handle('history:list', () => listQuestions())
  ipcMain.handle('history:get', (_e, id: string) => getQuestion(id))
  ipcMain.handle('history:toggleMonitor', (_e, id: string, enabled: boolean) =>
    setLiveMonitor(id, enabled)
  )
  ipcMain.handle('history:dismissUpdate', (_e, id: string) => dismissUpdate(id))
  ipcMain.handle('history:recheck', async (_e, id: string) => recheckQuestion(id))

  ipcMain.handle('dialog:pickFolder', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return res.canceled ? null : res.filePaths[0]
  })

  // Agent runs are streamed back to the renderer over a per-run channel.
  ipcMain.handle('agent:run', async (e, runId: string, history: ChatMessage[]) => {
    const sender = e.sender
    await runAgent(getSettings(), history, (step) => {
      if (!sender.isDestroyed()) sender.send(`agent:step:${runId}`, step)
    })
    if (!sender.isDestroyed()) sender.send(`agent:done:${runId}`)
  })
}
