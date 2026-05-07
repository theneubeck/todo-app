import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Things } from './Things'
import type { Task } from '../../data/parseTodo'

// Behaviors:
// 1. shows Today bucket with tasks whose due === today
// 2. shows Upcoming bucket with tasks whose due > today
// 3. shows Anytime bucket with tasks with no due
// 4. switching bucket via tab changes visible tasks
// 5. groups tasks under a project heading by project slug
// 6. groups projects under an area heading by first tag
// 7. clicking a checkbox calls onToggle(slug, [0])

const make = (over: Partial<Task> = {}): Task => ({
  slug: 't',
  title: 'A task',
  status: 'todo',
  tags: [],
  items: [{ text: 'do', done: false, children: [] }],
  ...over,
})

describe('Things', () => {
  it('shows tasks due today in the Today bucket by default', () => {
    render(
      <Things
        today="2026-05-06"
        tasks={[
          make({ slug: 'a', title: 'Today task', due: '2026-05-06' }),
          make({ slug: 'b', title: 'Future', due: '2026-12-01' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    const region = screen.getByRole('region', { name: 'Today' })
    expect(region).toHaveTextContent('Today task')
    expect(region).not.toHaveTextContent('Future')
  })

  it('switches to Upcoming bucket when its tab is clicked', async () => {
    render(
      <Things
        today="2026-05-06"
        tasks={[
          make({ slug: 'a', title: 'Today task', due: '2026-05-06' }),
          make({ slug: 'b', title: 'Future', due: '2026-12-01' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Upcoming' }))
    const region = screen.getByRole('region', { name: 'Upcoming' })
    expect(region).toHaveTextContent('Future')
    expect(region).not.toHaveTextContent('Today task')
  })

  it('shows tasks with no due in the Anytime bucket', async () => {
    render(
      <Things
        today="2026-05-06"
        tasks={[make({ slug: 'a', title: 'Whenever' })]}
        onToggle={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Anytime' }))
    expect(screen.getByRole('region', { name: 'Anytime' })).toHaveTextContent('Whenever')
  })

  it('groups tasks under their project heading', async () => {
    render(
      <Things
        today="2026-05-06"
        tasks={[
          make({ slug: 'a', title: 'Outline', project: 'q3-strategy' }),
          make({ slug: 'b', title: 'Review', project: 'q3-strategy' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Anytime' }))
    const project = screen.getByRole('group', { name: 'q3-strategy' })
    expect(project).toHaveTextContent('Outline')
    expect(project).toHaveTextContent('Review')
  })

  it('groups projects under their area (first tag)', async () => {
    render(
      <Things
        today="2026-05-06"
        tasks={[
          make({ slug: 'a', title: 'Outline', tags: ['work'], project: 'q3' }),
          make({ slug: 'b', title: 'Errand', tags: ['home'] }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Anytime' }))
    expect(screen.getByRole('region', { name: 'Anytime' })).toContainElement(
      screen.getByRole('region', { name: 'work' }),
    )
    expect(screen.getByRole('region', { name: 'home' })).toHaveTextContent('Errand')
  })

  it('clicking a checkbox calls onToggle with slug and path', async () => {
    const onToggle = vi.fn()
    render(
      <Things
        today="2026-05-06"
        tasks={[make({ slug: 'a', title: 'X', due: '2026-05-06', items: [{ text: 'step', done: false, children: [] }] })]}
        onToggle={onToggle}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'step' }))
    expect(onToggle).toHaveBeenCalledWith('a', [0])
  })
})
