/**
 * parseTodayFile — extract ordered wikilink slugs from a today.md body.
 *
 * Handles lines of the form:
 *   - [[slug-name]]
 *
 * Returns the slugs in the order they appear. Lines that do not match the
 * wikilink pattern are ignored.
 */
export function parseTodayFile(raw: string): string[] {
  const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
  const slugs: string[] = []
  let match: RegExpExecArray | null
  while ((match = WIKILINK_RE.exec(raw)) !== null) {
    slugs.push(match[1])
  }
  return slugs
}
