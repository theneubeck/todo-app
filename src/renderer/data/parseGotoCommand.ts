export type GotoTarget =
  | { kind: 'inbox' }
  | { kind: 'chat' }
  | { kind: 'tag'; value: string } // bare slug for #tags; "@handle" for @people

export function parseGotoCommand(input: string): GotoTarget | null {
  const trimmed = input.trim()
  // Case-insensitive prefix match for /goto
  if (!trimmed.toLowerCase().startsWith('/goto ')) return null

  const dest = trimmed.slice('/goto '.length).trim()
  if (dest.length === 0) return null

  const lower = dest.toLowerCase()
  if (lower === 'inbox') return { kind: 'inbox' }
  if (lower === 'chat') return { kind: 'chat' }

  if (dest.startsWith('#')) {
    const slug = dest.slice(1).toLowerCase()
    if (slug.length === 0) return null
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
