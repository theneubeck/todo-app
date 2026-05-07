import { describe, it, expect } from 'vitest'
import { parseInput } from './parseInput'

// Behaviors:
// 1. plain text becomes title
// 2. extracts #tag tokens
// 3. extracts p1..p4 priority token (case-insensitive)
// 4. defaults priority to p4 when absent
// 5. extracts "today" as the today ISO
// 6. extracts "tomorrow" as today + 1 day
// 7. extracts ISO date directly
// 8. combines all of the above into one result

describe('parseInput', () => {
  it('returns plain text as title', () => {
    expect(parseInput('Call dentist', '2026-05-06').title).toBe('Call dentist')
  })

  it('extracts #tag tokens', () => {
    const r = parseInput('Call dentist #personal #health', '2026-05-06')
    expect(r.tags).toEqual(['personal', 'health'])
    expect(r.title).toBe('Call dentist')
  })

  it('extracts p1..p4 priority', () => {
    expect(parseInput('Big task p1', '2026-05-06').priority).toBe('p1')
    expect(parseInput('Mid task P3', '2026-05-06').priority).toBe('p3')
  })

  it('defaults priority to p4 when absent', () => {
    expect(parseInput('Plain', '2026-05-06').priority).toBe('p4')
  })

  it('extracts "today" as today ISO', () => {
    expect(parseInput('Mail mom today', '2026-05-06').due).toBe('2026-05-06')
  })

  it('extracts "tomorrow" as today + 1 day', () => {
    expect(parseInput('Pay rent tomorrow', '2026-05-06').due).toBe('2026-05-07')
  })

  it('extracts ISO date directly', () => {
    expect(parseInput('Talk 2026-06-15', '2026-05-06').due).toBe('2026-06-15')
  })

  it('combines all markers and strips them from title', () => {
    const r = parseInput('Call dentist tomorrow #personal p2', '2026-05-06')
    expect(r.title).toBe('Call dentist')
    expect(r.tags).toEqual(['personal'])
    expect(r.priority).toBe('p2')
    expect(r.due).toBe('2026-05-07')
  })
})
