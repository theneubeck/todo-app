import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Linear } from './Linear'
import type { Task } from '../../data/parseTodo'

// Behaviors:
// 1. renders three status columns: Todo, Doing, Done
// 2. each task appears in the column matching its status
// 3. clicking a task's next-status button calls onChangeStatus(slug, newStatus)
// 4. Triage view shows only tasks without a cycle:<id> tag

const make = (over: Partial<Task> = {}): Task => ({
  slug: 't',
  title: 'A task',
  status: 'todo',
  tags: [],
  items: [],
  ...over,
})

describe('Linear', () => {
  it('renders three status columns', () => {
    render(<Linear tasks={[]} onChangeStatus={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Todo' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Doing' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Done' })).toBeInTheDocument()
  })

  it('places each task in the column matching its status', () => {
    render(
      <Linear
        tasks={[
          make({ slug: 'a', title: 'Pending', status: 'todo' }),
          make({ slug: 'b', title: 'Active', status: 'doing' }),
          make({ slug: 'c', title: 'Shipped', status: 'done' }),
        ]}
        onChangeStatus={vi.fn()}
      />,
    )
    expect(within(screen.getByRole('region', { name: 'Todo' })).getByText('Pending')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Doing' })).getByText('Active')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Done' })).getByText('Shipped')).toBeInTheDocument()
  })

  it('clicking a next-status button calls onChangeStatus with new status', async () => {
    const onChangeStatus = vi.fn()
    render(
      <Linear
        tasks={[make({ slug: 'a', title: 'X', status: 'todo' })]}
        onChangeStatus={onChangeStatus}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'X advance status' }))
    expect(onChangeStatus).toHaveBeenCalledWith('a', 'doing')
  })

  it('advances doing to done', async () => {
    const onChangeStatus = vi.fn()
    render(
      <Linear
        tasks={[make({ slug: 'a', title: 'X', status: 'doing' })]}
        onChangeStatus={onChangeStatus}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'X advance status' }))
    expect(onChangeStatus).toHaveBeenCalledWith('a', 'done')
  })

  it('triage view shows only tasks without a cycle tag', async () => {
    render(
      <Linear
        tasks={[
          make({ slug: 'a', title: 'Triaged', tags: ['cycle:1'] }),
          make({ slug: 'b', title: 'Loose' }),
        ]}
        onChangeStatus={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Triage' }))
    const triage = screen.getByRole('region', { name: 'Triage' })
    expect(within(triage).getByText('Loose')).toBeInTheDocument()
    expect(within(triage).queryByText('Triaged')).not.toBeInTheDocument()
  })
})
