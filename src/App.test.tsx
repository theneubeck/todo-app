import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import type { Task } from './data/parseTodo'

// Behaviors:
// 1. shows a tab for each of the six patterns
// 2. defaults to the Reminders pattern
// 3. clicking each tab renders that pattern

const sampleTasks: Task[] = [
  {
    slug: 'a',
    title: 'Sample',
    status: 'todo',
    tags: ['work', 'sprint:s1'],
    items: [{ text: 'do', done: false, children: [] }],
  },
]

const noop = vi.fn()

describe('App', () => {
  it('shows a tab for each of the six patterns', () => {
    render(<App tasks={sampleTasks} today="2026-05-06" sprint="s1" onToggle={noop} onChangeStatus={noop} onCreate={noop} />)
    for (const name of ['Reminders', 'Things', 'Todoist', 'Acunote', 'Outline', 'Linear']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
  })

  it('defaults to Reminders pattern', () => {
    render(<App tasks={sampleTasks} today="2026-05-06" sprint="s1" onToggle={noop} onChangeStatus={noop} onCreate={noop} />)
    // Reminders renders the work group when given a tagged task
    expect(screen.getByRole('region', { name: 'work' })).toBeInTheDocument()
  })

  it('clicking Linear tab renders the Linear board', async () => {
    render(<App tasks={sampleTasks} today="2026-05-06" sprint="s1" onToggle={noop} onChangeStatus={noop} onCreate={noop} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Linear' }))
    expect(screen.getByRole('region', { name: 'Todo' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Doing' })).toBeInTheDocument()
  })

  it('clicking Outline tab renders the tree', async () => {
    render(<App tasks={sampleTasks} today="2026-05-06" sprint="s1" onToggle={noop} onChangeStatus={noop} onCreate={noop} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Outline' }))
    expect(screen.getByRole('tree')).toBeInTheDocument()
  })

  it('clicking Acunote tab renders the sprint', async () => {
    render(<App tasks={sampleTasks} today="2026-05-06" sprint="s1" onToggle={noop} onChangeStatus={noop} onCreate={noop} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Acunote' }))
    expect(screen.getByRole('heading', { name: 'Sprint s1' })).toBeInTheDocument()
  })
})
