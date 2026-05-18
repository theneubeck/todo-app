import fs from 'fs'
import path from 'path'

const TODAY_FILENAME = 'today.md'
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

/**
 * Read `vault/todos/today.md` and return the ordered list of slugs.
 * Returns an empty array if the file does not exist.
 */
export function readTodayFile(dir: string): string[] {
  const filePath = path.join(dir, TODAY_FILENAME)
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  const slugs: string[] = []
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(raw)) !== null) {
    slugs.push(match[1])
  }
  return slugs
}

/**
 * Write `vault/todos/today.md` with the given ordered slug list.
 */
export function writeTodayFile(dir: string, slugs: string[], date: string): void {
  const filePath = path.join(dir, TODAY_FILENAME)
  const links = slugs.map((s) => `- [[${s}]]`).join('\n')
  const content = `---\ntype: today\ndate: ${date}\n---\n${links ? links + '\n' : ''}`
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}
