import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Outline } from './Outline'
import type { Task } from '../../data/parseTodo'

// Behaviors:
// 1. renders a node for each top-level task
// 2. renders nested items as descendant nodes
// 3. clicking a node zooms to that node (only subtree visible)
// 4. zoom shows breadcrumb leading back to root
// 5. clicking root breadcrumb unzooms
// 6. clicking the collapse handle hides children
// 7. clicking a checkbox calls onToggle(slug, path)

const make = (over: Partial<Task> = {}): Task => ({
  slug: 't',
  title: 'A task',
  status: 'todo',
  tags: [],
  items: [],
  ...over,
})

describe('Outline', () => {
  it('renders a node for each top-level task', () => {
    render(
      <Outline
        tasks={[make({ slug: 'a', title: 'First' }), make({ slug: 'b', title: 'Second' })]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('renders nested items as descendant nodes', () => {
    render(
      <Outline
        tasks={[
          make({
            slug: 'a',
            title: 'Root',
            items: [
              {
                text: 'L1',
                done: false,
                children: [{ text: 'L2', done: false, children: [] }],
              },
            ],
          }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
  })

  it('clicking a node zooms to its subtree', async () => {
    render(
      <Outline
        tasks={[
          make({ slug: 'a', title: 'Keep', items: [{ text: 'inside', done: false, children: [] }] }),
          make({ slug: 'b', title: 'Hide me' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'zoom Keep' }))
    expect(screen.getByText('inside')).toBeInTheDocument()
    expect(screen.queryByText('Hide me')).not.toBeInTheDocument()
  })

  it('shows breadcrumb back to root when zoomed', async () => {
    render(<Outline tasks={[make({ slug: 'a', title: 'Keep' })]} onToggle={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'zoom Keep' }))
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('clicking Home breadcrumb unzooms', async () => {
    render(
      <Outline
        tasks={[
          make({ slug: 'a', title: 'Keep' }),
          make({ slug: 'b', title: 'Other' }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'zoom Keep' }))
    expect(screen.queryByText('Other')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('clicking collapse handle hides children of a node', async () => {
    render(
      <Outline
        tasks={[
          make({
            slug: 'a',
            title: 'Parent',
            items: [{ text: 'hidden', done: false, children: [] }],
          }),
        ]}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('hidden')).toBeInTheDocument()
    const node = screen.getByRole('treeitem', { name: 'Parent' })
    await userEvent.click(within(node).getByRole('button', { name: 'collapse' }))
    expect(screen.queryByText('hidden')).not.toBeInTheDocument()
  })

  it('clicking a checkbox calls onToggle with slug and path', async () => {
    const onToggle = vi.fn()
    render(
      <Outline
        tasks={[
          make({
            slug: 'a',
            title: 'Root',
            items: [
              {
                text: 'first',
                done: false,
                children: [{ text: 'inner', done: false, children: [] }],
              },
            ],
          }),
        ]}
        onToggle={onToggle}
      />,
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'inner' }))
    expect(onToggle).toHaveBeenCalledWith('a', [0, 0])
  })
})
