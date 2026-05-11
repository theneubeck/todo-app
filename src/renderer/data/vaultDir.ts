import type { Task } from './parseTodo'

/**
 * Resolve the directory that holds task `.md` files for the active vault.
 *
 * Priority:
 *   1. If `vaultPath` is provided, return `${vaultPath}/todos` directly.
 *      This is the production path — `vaultPath` is the absolute root of the
 *      active vault (e.g. `/Users/alice/vaults/work`).
 *   2. If `vaultPath` is null but the loaded tasks list is non-empty, derive
 *      the directory from any existing task's `filePath`. This back-compat
 *      branch keeps legacy callers (renderer tests that mount without a
 *      vault path) working.
 *   3. Otherwise, fall back to the legacy relative path `vault/todos`. This
 *      is preserved only to keep older tests green; production never hits it.
 *
 * Uses `/` as the path separator (renderer is posix-style). On the main
 * process, `path.resolve` handles whatever string this returns.
 */
export function vaultDir(vaultPath: string | null, tasks: Task[]): string {
  if (vaultPath) {
    return `${vaultPath}/todos`
  }
  for (const t of tasks) {
    const idx = t.filePath.lastIndexOf('/')
    if (idx > -1) {
      const dir = t.filePath.slice(0, idx)
      if (dir) return dir
    }
  }
  return 'vault/todos'
}
