import fs from 'fs'
import path from 'path'

export function createVault(targetDir: string): void {
  fs.mkdirSync(path.join(targetDir, 'todos'), { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'archive', 'todos'), { recursive: true })
}
