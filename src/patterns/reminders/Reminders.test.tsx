import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Reminders } from './Reminders'
import type { Task } from '../../data/parseTodo'

// Behaviors:
// 1. renders each task title
// 2. groups tasks by first tag (Inbox when none)
// 3. shows badge count per group of incomplete top-level items
// 4. checkbox reflects item done state
// 5. clicking a checkbox calls onToggle(slug, [index])
// 6. renders nested subtasks under a parent
// 7. completed top-level items render with aria-checked="true"

const make = (over: Partial<Task> = {}): Task => ({
  slug: 't',
  title: 'A task',
  status: 'todo',
  tags: [],
  items: [{ text: 'Step', done: false, children: [] }],
  ...over,
})

describe('Reminders', () => {
  it('renders each task title', () => {
    render(<Reminders tasks={[make({ slug: 'one', title: 'First' }), make({ slug: 'two', title: 'Second' })]} onToggle={vi.fn()} />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('groups tasks by first tag', () => {
    render(
      <Reminders
        tasks={[
          make({ slug: 'a', title: 'Work A', tags: ['work'] }),
          make({ slug: 'b', title: 'Home B', tags: ['home'] }),
          make({ slug: 'c', title: 'Work C', tags: ['work', 'q3'] }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    const work = screen.getByRole('region', { name: 'work' })
    const home = screen.getByRole('region', { name: 'home' })
    expect(work).toHaveTextContent('Work A')
    expect(work).toHaveTextContent('Work C')
    expect(home).toHaveTextContent('Home B')
    expect(home).not.toHaveTextContent('Work A')
  })

  it('groups untagged tasks under Inbox', () => {
    render(<Reminders tasks={[make({ slug: 'x', title: 'Untagged', tags: [] })]} onToggle={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Inbox' })).toHaveTextContent('Untagged')
  })

  it('renders a checkbox for each top-level item', () => {
    render(
      <Reminders
        tasks={[make({ slug: 'a', title: 'Has step', items: [{ text: 'Do it', done: false, children: [] }] })]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Do it' })).not.toBeChecked()
  })

  it('renders checked state for done items', () => {
    render(
      <Reminders
        tasks={[make({ slug: 'a', title: 'X', items: [{ text: 'Done step', done: true, children: [] }] })]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'Done step' })).toBeChecked()
  })

  it('clicking a checkbox calls onToggle with slug and path', async () => {
    const onToggle = vi.fn()
    render(
      <Reminders
        tasks={[
          make({
            slug: 'a',
            items: [
              { text: 'first', done: false, children: [] },
              { text: 'second', done: false, children: [] },
            ],
          }),
        ]}
        onToggle={onToggle}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'second' }))
    expect(onToggle).toHaveBeenCalledWith('a', [1])
  })

  it('renders nested subtasks under their parent', () => {
    render(
      <Reminders
        tasks={[
          make({
            slug: 'a',
            items: [
              {
                text: 'parent',
                done: false,
                children: [{ text: 'child', done: false, children: [] }],
              },
            ],
          }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'child' })).toBeInTheDocument()
  })

  it('shows badge count of incomplete tasks per group', () => {
    render(
      <Reminders
        tasks={[
          make({ slug: 'a', title: 'A', tags: ['work'], status: 'todo' }),
          make({ slug: 'b', title: 'B', tags: ['work'], status: 'done' }),
          make({ slug: 'c', title: 'C', tags: ['work'], status: 'doing' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    const badge = screen.getByLabelText('work incomplete count')
    expect(badge).toHaveTextContent('2')
  })
})
