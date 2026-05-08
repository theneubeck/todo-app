// Pure file-builder for new tasks created via /add. No DOM, no fs.
//
// Inputs:
//   title              — the title typed by the user (already trimmed/joined by parseAddCommand)
//   tags               — already-normalised tag values (lowercased; @-prefixed for people)
//   today              — ISO date string (YYYY-MM-DD); the renderer passes a fixed value to keep
//                        tests deterministic
//   existingFilenames  — bare filenames already present in vault/todos. On collision we append
//                        `-2`, `-3`, …
//
// Output:
//   filename — e.g. `buy-milk-2026-05-07.md`
//   content  — frontmatter + empty body, ready for window.todoz.writeFile

export type BuildTaskInput = {
  title: string
  tags: string[]
  today: string
  existingFilenames: string[]
}

export type BuildTaskOutput = {
  filename: string
  content: string
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function uniqueFilename(base: string, existing: string[]): string {
  const baseFile = `${base}.md`
  if (!existing.includes(baseFile)) return baseFile
  let n = 2
  while (existing.includes(`${base}-${n}.md`)) {
    n += 1
  }
  return `${base}-${n}.md`
}

function formatTag(tag: string): string {
  // YAML-safe rendering: bare-word for plain tags, double-quoted when the tag
  // starts with `@` (since `@` is reserved at YAML scalar starts).
  if (tag.startsWith('@')) return `"${tag}"`
  return tag
}

function buildFrontmatter(title: string, tags: string[], today: string): string {
  const tagList = tags.map(formatTag).join(', ')
  return [
    '---',
    'type: task',
    `title: "${title}"`,
    'status: todo',
    `tags: [${tagList}]`,
    `created: ${today}`,
    '---',
    '',
  ].join('\n')
}

export function buildTaskFile(input: BuildTaskInput): BuildTaskOutput {
  const { title, tags, today, existingFilenames } = input
  const slug = slugify(title)
  const base = `${slug}-${today}`
  const filename = uniqueFilename(base, existingFilenames)
  const content = buildFrontmatter(title, tags, today)
  return { filename, content }
}
