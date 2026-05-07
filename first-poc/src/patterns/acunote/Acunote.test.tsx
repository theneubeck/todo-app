import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Acunote } from './Acunote'
import type { Task } from '../../data/parseTodo'

// Behaviors:
// 1. shows the current sprint id as heading
// 2. only tasks tagged sprint:<id> appear
// 3. weight from w:<n> tag (default 1) shown next to title
// 4. burndown shows total remaining weight (sum across non-done tasks)
// 5. clicking a task row expands to show its subtasks
// 6. clicking a checkbox calls onToggle(slug, [i])

const make = (over: Partial<Task> = {}): Task => ({
  slug: 't',
  title: 'A task',
  status: 'todo',
  tags: [],
  items: [{ text: 'do', done: false, children: [] }],
  ...over,
})

describe('Acunote', () => {
  it('shows the current sprint id as heading', () => {
    render(<Acunote sprint="2026-w19" tasks={[]} onToggle={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Sprint 2026-w19' })).toBeInTheDocument()
  })

  it('shows only tasks belonging to the sprint', () => {
    render(
      <Acunote
        sprint="2026-w19"
        tasks={[
          make({ slug: 'a', title: 'In sprint', tags: ['sprint:2026-w19'] }),
          make({ slug: 'b', title: 'Not in sprint', tags: ['sprint:2026-w20'] }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    const list = screen.getByRole('list', { name: 'sprint tasks' })
    expect(within(list).getByText('In sprint')).toBeInTheDocument()
    expect(within(list).queryByText('Not in sprint')).not.toBeInTheDocument()
  })

  it('renders weight from w:<n> tag, defaulting to 1', () => {
    render(
      <Acunote
        sprint="s"
        tasks={[
          make({ slug: 'a', title: 'Heavy', tags: ['sprint:s', 'w:5'] }),
          make({ slug: 'b', title: 'Light', tags: ['sprint:s'] }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Heavy weight')).toHaveTextContent('5')
    expect(screen.getByLabelText('Light weight')).toHaveTextContent('1')
  })

  it('burndown shows total remaining weight across non-done tasks', () => {
    render(
      <Acunote
        sprint="s"
        tasks={[
          make({ slug: 'a', tags: ['sprint:s', 'w:3'], status: 'todo' }),
          make({ slug: 'b', tags: ['sprint:s', 'w:2'], status: 'doing' }),
          make({ slug: 'c', tags: ['sprint:s', 'w:4'], status: 'done' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('remaining weight')).toHaveTextContent('5')
  })

  it('clicking a task row expands to show its subtasks', async () => {
    render(
      <Acunote
        sprint="s"
        tasks={[
          make({
            slug: 'a',
            title: 'Parent',
            tags: ['sprint:s'],
            items: [{ text: 'child step', done: false, children: [] }],
          }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.queryByText('child step')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Parent' }))
    expect(screen.getByText('child step')).toBeInTheDocument()
  })

  it('clicking a checkbox calls onToggle(slug, [0])', async () => {
    const onToggle = vi.fn()
    render(
      <Acunote
        sprint="s"
        tasks={[make({ slug: 'a', title: 'P', tags: ['sprint:s'], items: [{ text: 'step', done: false, children: [] }] })]}
        onToggle={onToggle}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'P' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'step' }))
    expect(onToggle).toHaveBeenCalledWith('a', [0])
  })
})
