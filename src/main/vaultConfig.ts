import fs from 'fs'
import path from 'path'

export interface VaultConfig {
  lastOpened: string | null
  recents: string[]
}

const EMPTY: VaultConfig = { lastOpened: null, recents: [] }

export function readVaultConfig(configPath: string): VaultConfig {
  if (!fs.existsSync(configPath)) {
    return { lastOpened: null, recents: [] }
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<VaultConfig>
    return {
      lastOpened: parsed.lastOpened ?? null,
      recents: Array.isArray(parsed.recents) ? parsed.recents : [],
    }
  } catch {
    return { ...EMPTY }
  }
}

export function writeVaultConfig(configPath: string, config: VaultConfig): void {
  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function addRecent(configPath: string, vaultPath: string): void {
  const cfg = readVaultConfig(configPath)
  const next = [vaultPath, ...cfg.recents.filter((p) => p !== vaultPath)]
  writeVaultConfig(configPath, { ...cfg, recents: next })
}

export function removeRecent(configPath: string, vaultPath: string): void {
  const cfg = readVaultConfig(configPath)
  writeVaultConfig(configPath, {
    ...cfg,
    recents: cfg.recents.filter((p) => p !== vaultPath),
  })
}

export function setLastOpened(configPath: string, vaultPath: string | null): void {
  const cfg = readVaultConfig(configPath)
  writeVaultConfig(configPath, { ...cfg, lastOpened: vaultPath })
}
