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

// Schema version written into every settings file. Files without this key
// were written by an older version that defaulted showChat to true — migrate
// them to showChat: false so chat stays opt-in.
const SCHEMA_VERSION = 1

export function readAppSettings(settingsPath: string): AppSettings {
  if (!fs.existsSync(settingsPath)) {
    return { ...DEFAULTS }
  }
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { _v?: number }
    const isLegacy = (parsed._v ?? 0) < SCHEMA_VERSION
    return {
      // Legacy files had showChat: true as the old default — treat as false.
      showChat: isLegacy ? false : (parsed.showChat ?? DEFAULTS.showChat),
      showToday: parsed.showToday ?? DEFAULTS.showToday,
      showUpcoming: parsed.showUpcoming ?? DEFAULTS.showUpcoming,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function migrateAppSettings(settingsPath: string): void {
  if (!fs.existsSync(settingsPath)) return
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { _v?: number }
    if ((parsed._v ?? 0) >= SCHEMA_VERSION) return
    const migrated = { ...readAppSettings(settingsPath), _v: SCHEMA_VERSION }
    fs.writeFileSync(settingsPath, JSON.stringify(migrated, null, 2), 'utf-8')
  } catch {
    // Non-fatal — app still starts with defaults.
  }
}

export function writeAppSetting(
  settingsPath: string,
  key: AppSettingKey,
  value: boolean
): void {
  const current = readAppSettings(settingsPath)
  const next = { ...current, [key]: value, _v: SCHEMA_VERSION }
  const dir = path.dirname(settingsPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8')
}
