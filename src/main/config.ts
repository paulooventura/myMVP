import { app } from 'electron'
import Store from 'electron-store'
import type { AppSettings } from '../shared/types'

const defaults: AppSettings = {
  openaiApiKey: '',
  geminiApiKey: '',
  anthropicApiKey: '',
  openaiModel: 'gpt-4o',
  geminiModel: 'gemini-1.5-flash',
  anthropicModel: 'claude-3-5-sonnet-latest',
  workspaceDir: '',
  liveMonitorEnabled: true,
  liveMonitorIntervalMinutes: 30
}

const store = new Store<AppSettings>({ name: 'mymvp-settings', defaults })

export function getSettings(): AppSettings {
  const s = store.store
  // Fall back the workspace dir to the user's home if unset.
  if (!s.workspaceDir) {
    s.workspaceDir = app.getPath('home')
  }
  return s
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value as never)
  }
  return getSettings()
}
