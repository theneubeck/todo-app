// Pure parser for the /focus slash command. No DOM, no fs.
//
// Grammar:
//   /focus <name-token>* <tag-token>*
//   tag-token := /^#\S+/  (becomes tag without the leading #, lowercased)
// Tokens are split by whitespace. The order of tokens does not matter; tags
// can appear anywhere after `/focus`. The remaining (non-tag) tokens form the
// name, joined by single spaces, in original order.
//
// Returns null when:
//   - the input does not start with `/focus` (after trimming leading whitespace)
//   - the name (non-tag tokens, joined and trimmed) is empty

export type Focus = {
  id: string
  name: string
  tags: string[]
}

export type FocusCommand = {
  name: string
  tags: string[]
}

const FOCUS_RE = /^\s*\/focus(?:\s+(.*))?$/s

export function parseFocusCommand(input: string): FocusCommand | null {
  if (typeof input !== 'string') return null
  const match = FOCUS_RE.exec(input)
  if (!match) return null
  const rest = (match[1] ?? '').trim()
  if (rest === '') return null
  const tokens = rest.split(/\s+/).filter((t) => t.length > 0)
  const nameTokens: string[] = []
  const tags: string[] = []
  for (const token of tokens) {
    if (token.startsWith('#')) {
      const value = token.slice(1).toLowerCase()
      if (value.length > 0) tags.push(value)
    } else {
      nameTokens.push(token)
    }
  }
  const name = nameTokens.join(' ').trim()
  if (name.length === 0) return null
  return { name, tags }
}
