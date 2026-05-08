import path from 'path'

export function getVaultPath(): string {
  const root = process.cwd()
  return process.env.NODE_ENV === 'test'
    ? path.join(root, 'test', 'fixtures', 'vault')
    : path.join(root, 'vault')
}
