import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Todoist } from './Todoist'
import type { Task } from '../../data/parseTodo'

// Behaviors:
// 1. renders task title
// 2. renders priority flag from p1..p4 tag
// 3. tasks sorted by priority ascending (P1 first)
// 4. typing input + Enter calls onCreate with parsed result
// 5. clicking checkbox calls onToggle(slug, [0])
// 6. Today filter shows only tasks due today

const make = (over: Partial<Task> = {}): Task => ({
  slug: 't',
  title: 'A task',
  status: 'todo',
  tags: [],
  items: [{ text: 'do', done: false, children: [] }],
  ...over,
})

describe('Todoist', () => {
  it('renders task title', () => {
    render(<Todoist tasks={[make({ slug: 'a', title: 'Hello' })]} today="2026-05-06" onToggle={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders priority flag from p1..p4 tag', () => {
    render(
      <Todoist
        tasks={[make({ slug: 'a', title: 'Urgent', tags: ['p1', 'work'] })]}
        today="2026-05-06"
        onToggle={vi.fn()}
        onCreate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('priority p1')).toBeInTheDocument()
  })

  it('sorts tasks by priority ascending (P1 first)', () => {
    render(
      <Todoist
        tasks={[
          make({ slug: 'a', title: 'Low', tags: ['p4'] }),
          make({ slug: 'b', title: 'High', tags: ['p1'] }),
          make({ slug: 'c', title: 'Mid', tags: ['p2'] }),
        ]}
        today="2026-05-06"
        onToggle={vi.fn()}
        onCreate={vi.fn()}
      />,
    )
    const list = screen.getByRole('list', { name: 'tasks' })
    const items = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list)
    expect(items[0]).toHaveTextContent('High')
    expect(items[1]).toHaveTextContent('Mid')
    expect(items[2]).toHaveTextContent('Low')
  })

  it('typing input and pressing Enter calls onCreate with parsed values', async () => {
    const onCreate = vi.fn()
    render(<Todoist tasks={[]} today="2026-05-06" onToggle={vi.fn()} onCreate={onCreate} />)
    const input = screen.getByRole('textbox', { name: 'Add task' })
    await userEvent.type(input, 'Call mom tomorrow #personal p2{Enter}')
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Call mom',
      tags: ['personal'],
      priority: 'p2',
      due: '2026-05-07',
    })
  })

  it('clicking checkbox calls onToggle(slug, [0])', async () => {
    const onToggle = vi.fn()
    render(
      <Todoist
        tasks={[make({ slug: 'a', title: 'X', items: [{ text: 'step', done: false, children: [] }] })]}
        today="2026-05-06"
        onToggle={onToggle}
        onCreate={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'step' }))
    expect(onToggle).toHaveBeenCalledWith('a', [0])
  })

  it('Today filter shows only tasks due today', async () => {
    render(
      <Todoist
        tasks={[
          make({ slug: 'a', title: 'Today task', due: '2026-05-06' }),
          make({ slug: 'b', title: 'Future', due: '2026-12-01' }),
        ]}
        today="2026-05-06"
        onToggle={vi.fn()}
        onCreate={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    const list = screen.getByRole('list', { name: 'tasks' })
    expect(within(list).getByText('Today task')).toBeInTheDocument()
    expect(within(list).queryByText('Future')).not.toBeInTheDocument()
  })
})
