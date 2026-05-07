const CHECKBOX = /^(\s*)- \[( |x)\] (.*)$/
const INDENT = 2

function pathEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function toggleTask(source: string, target: number[]): string {
  const lines = source.split('\n')
  const stack: { depth: number; index: number }[] = []
  const counters: Record<string, number> = {}

  for (let i = 0; i < lines.length; i++) {
    const m = CHECKBOX.exec(lines[i])
    if (!m) continue
    const depth = Math.floor(m[1].length / INDENT)
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
    const parentKey = stack.map((s) => s.index).join('.')
    const idx = (counters[parentKey] = (counters[parentKey] ?? -1) + 1)
    stack.push({ depth, index: idx })
    if (pathEqual(stack.map((s) => s.index), target)) {
      const flipped = m[2] === ' ' ? 'x' : ' '
      lines[i] = `${m[1]}- [${flipped}] ${m[3]}`
      return lines.join('\n')
    }
  }
  return source
}
