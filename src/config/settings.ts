import path from 'path'
import { readVaultConfig } from '../main/vaultConfig'

export function getVaultPath(): string | null {
  const root = process.cwd()
  if (process.env.NODE_ENV === 'test') {
    return path.join(root, 'test', 'fixtures', 'vault')
  }
  // In production, the active vault path is sourced from vault-config.json in
  // userData. The caller (main process) supplies the absolute config path.
  return null
}

export function resolveProductionVaultPath(configPath: string): string | null {
  const cfg = readVaultConfig(configPath)
  return cfg.lastOpened
}
