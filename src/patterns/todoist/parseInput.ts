export type Priority = 'p1' | 'p2' | 'p3' | 'p4'

export type ParsedInput = {
  title: string
  tags: string[]
  priority: Priority
  due?: string
}

const TAG = /(?:^|\s)#([a-z0-9-]+)/gi
const PRIORITY = /(?:^|\s)(p[1-4])\b/i
const ISO = /(?:^|\s)(\d{4}-\d{2}-\d{2})\b/
const TODAY = /(?:^|\s)today\b/i
const TOMORROW = /(?:^|\s)tomorrow\b/i

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function parseInput(input: string, today: string): ParsedInput {
  let s = input
  const tags: string[] = []
  s = s.replace(TAG, (_m, t) => {
    tags.push(t.toLowerCase())
    return ''
  })

  let priority: Priority = 'p4'
  const pm = PRIORITY.exec(s)
  if (pm) {
    priority = pm[1].toLowerCase() as Priority
    s = s.replace(PRIORITY, '')
  }

  let due: string | undefined
  const isoMatch = ISO.exec(s)
  if (isoMatch) {
    due = isoMatch[1]
    s = s.replace(ISO, '')
  } else if (TOMORROW.test(s)) {
    due = addDays(today, 1)
    s = s.replace(TOMORROW, '')
  } else if (TODAY.test(s)) {
    due = today
    s = s.replace(TODAY, '')
  }

  return { title: s.replace(/\s+/g, ' ').trim(), tags, priority, due }
}
