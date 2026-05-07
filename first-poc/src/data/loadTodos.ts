import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseTodo, Task } from './parseTodo'

export function loadTodos(dir: string): Task[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseTodo(f, readFileSync(path.join(dir, f), 'utf-8')))
}
