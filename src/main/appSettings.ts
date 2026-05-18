import fs from 'fs'
import path from 'path'

export interface AppSettings {
  showChat: boolean
  showToday: boolean
  showUpcoming: boolean
}

export type AppSettingKey = keyof AppSettings

const DEFAULTS: AppSettings = {
  showChat: false,
  showToday: true,
  showUpcoming: true,
}

export function readAppSettings(settingsPath: string): AppSettings {
  if (!fs.existsSync(settingsPath)) {
    return { ...DEFAULTS }
  }
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      showChat: parsed.showChat ?? DEFAULTS.showChat,
      showToday: parsed.showToday ?? DEFAULTS.showToday,
      showUpcoming: parsed.showUpcoming ?? DEFAULTS.showUpcoming,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeAppSetting(
  settingsPath: string,
  key: AppSettingKey,
  value: boolean
): void {
  const current = readAppSettings(settingsPath)
  const next: AppSettings = { ...current, [key]: value }
  const dir = path.dirname(settingsPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8')
}
