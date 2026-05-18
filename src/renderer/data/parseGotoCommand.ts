export type GotoTarget =
  | { kind: 'inbox' }
  | { kind: 'today' }
  | { kind: 'chat' }
  | { kind: 'tag'; value: string } // bare slug for #tags; "@handle" for @people

// Reserved #-tags that map to named views rather than tag filters.
const RESERVED: Record<string, GotoTarget> = {
  inbox: { kind: 'inbox' },
  today: { kind: 'today' },
}

export function parseGotoCommand(input: string): GotoTarget | null {
  const trimmed = input.trim()
  // Case-insensitive prefix match for /goto
  if (!trimmed.toLowerCase().startsWith('/goto ')) return null

  const dest = trimmed.slice('/goto '.length).trim()
  /* istanbul ignore next */
  if (dest.length === 0) return null

  const lower = dest.toLowerCase()

  // Bare words: "inbox", "chat", "today"
  if (lower === 'chat') return { kind: 'chat' }
  if (RESERVED[lower]) return RESERVED[lower]

  if (dest.startsWith('#')) {
    const slug = dest.slice(1).toLowerCase()
    if (slug.length === 0) return null
    // #inbox and #today are reserved — map to their named views.
    if (RESERVED[slug]) return RESERVED[slug]
    return { kind: 'tag', value: slug }
  }

  if (dest.startsWith('@')) {
    const handle = dest.slice(1).toLowerCase()
    if (handle.length === 0) return null
    return { kind: 'tag', value: '@' + handle }
  }

  if (dest.startsWith(':') && dest.length > 1) {
    return { kind: 'tag', value: dest.toLowerCase() }
  }

  return null
}
