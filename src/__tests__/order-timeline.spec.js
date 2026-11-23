import { expect, it } from 'vitest'
import { orderTimeline } from '../utils/orderHistory'

const createdAt = '2026-11-22T13:48:00Z'

it('produces one Draft milestone on every visit without changing other timelines', () => {
  const draft = { status: 'draft', created_at: createdAt, status_history: [], completed_at: null }
  const pending = { ...draft, status: 'pending' }
  const pendingKeys = orderTimeline(pending).map(({ key }) => key)

  for (let index = 0; index < 5; index++) {
    const timeline = orderTimeline(draft)
    expect(timeline.find(({ key }) => key === 'draft')?.at).toBe(createdAt)
    expect(timeline.map(({ key }) => key)).toEqual([
      'created',
      'draft',
      'pending',
      'confirmed',
      'processing',
      'ready',
      'completed',
    ])
  }

  expect(orderTimeline(pending).map(({ key }) => key)).toEqual(pendingKeys)
  expect(pendingKeys).not.toContain('draft')
})

it('includes a single Draft milestone for an order that later moved out of Draft', () => {
  const at = '2026-11-22T14:00:00Z'
  const order = {
    status: 'pending',
    created_at: createdAt,
    completed_at: null,
    status_history: [{ previous_status: 'draft', new_status: 'pending', created_at: at }],
  }
  const timeline = orderTimeline(order)

  expect(timeline.filter(({ key }) => key === 'draft')).toEqual([
    { key: 'draft', title: 'Draft', at: createdAt, reached: true },
  ])
  expect(timeline.find(({ key }) => key === 'pending')).toMatchObject({ at, reached: true })
})
