// Pure parser for the /add slash command. No DOM, no fs.
//
// Grammar:
//   /add <title-token>* <tag-token>*
//   tag-token := /^#\S+/  (becomes tag without the leading #, lowercased)
//             |  /^@\S+/  (kept with the leading @, lowercased)
// Tokens are split by whitespace. The order of tokens does not matter; tags
// can appear anywhere after `/add`. The remaining (non-tag) tokens form the
// title, joined by single spaces, in original order.
//
// Returns null when:
//   - the input does not start with `/add` (after trimming leading whitespace)
//   - the title (non-tag tokens, joined and trimmed) is empty

export type AddCommand = {
  title: string
  tags: string[]
}

const ADD_RE = /^\s*\/add(?:\s+(.*))?$/s

export function parseAddCommand(input: string): AddCommand | null {
  if (typeof input !== 'string') return null
  const match = ADD_RE.exec(input)
  if (!match) return null
  const rest = (match[1] ?? '').trim()
  if (rest === '') return null
  const tokens = rest.split(/\s+/).filter((t) => t.length > 0)
  const titleTokens: string[] = []
  const tags: string[] = []
  for (const token of tokens) {
    if (token.startsWith('#')) {
      const value = token.slice(1).toLowerCase()
      if (value.length > 0) tags.push(value)
    } else if (token.startsWith('@')) {
      const handle = token.slice(1).toLowerCase()
      if (handle.length > 0) tags.push(`@${handle}`)
    } else {
      titleTokens.push(token)
    }
  }
  const title = titleTokens.join(' ').trim()
  if (title.length === 0) return null
  return { title, tags }
}
