import path from 'path'

/**
 * Returns true iff the resolved `target` path lives inside the resolved
 * `vaultRoot` directory tree. Returns false when `vaultRoot` is null or
 * when `target` escapes the root via `..`.
 *
 * Used by the main-process `write-file` IPC handler to refuse writes
 * outside the active vault, so a renderer-side regression of the original
 * vault-write-path bug fails loud instead of silently writing to the wrong
 * directory.
 */
export function isPathInsideActiveVault(
  target: string,
  vaultRoot: string | null
): boolean {
  if (!vaultRoot) return false
  const resolvedRoot = path.resolve(vaultRoot)
  const resolvedTarget = path.resolve(target)
  const rel = path.relative(resolvedRoot, resolvedTarget)
  if (rel === '') return true
  if (rel.startsWith('..')) return false
  if (path.isAbsolute(rel)) return false
  return true
}
