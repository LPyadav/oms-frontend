import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import { ApiError } from '../api/client'
import OrderDetailView from '../views/orders/OrderDetailView.vue'

const { request, stub } = vi.hoisted(() => ({
  request: vi.fn(),
  stub: (tag) => ({
    setup(_, { slots }) {
      return () => h(tag, slots.default?.())
    },
  }),
}))

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
  useRouter: () => ({}),
}))
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    request,
    isAuthenticated: true,
    canViewOrders: true,
    canChangeAssignedOrderStatus: true,
    user: { id: 3 },
  }),
}))
vi.mock('vuetify/components/VAlert', () => ({ VAlert: stub('div') }))
vi.mock('vuetify/components/VBtn', () => ({ VBtn: stub('button') }))
vi.mock('vuetify/components/VCard', () => ({ VCard: stub('div') }))
vi.mock('vuetify/components/VChip', () => ({ VChip: stub('span') }))
vi.mock('vuetify/components/VDialog', () => ({ VDialog: stub('div') }))
vi.mock('vuetify/components/VProgressLinear', () => ({ VProgressLinear: stub('div') }))
vi.mock('vuetify/components/VTextarea', () => ({ VTextarea: stub('textarea') }))
vi.mock('vuetify/components/VSelect', () => ({
  VSelect: {
    props: ['items', 'modelValue'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h(
          'select',
          {
            value: props.modelValue,
            onChange: (event) => emit('update:modelValue', event.target.value),
          },
          props.items.map(({ title, value }) => h('option', { value }, title)),
        )
    },
  },
}))
vi.mock('../components/orders/OrderItemsCard.vue', () => ({ default: stub('div') }))
vi.mock('../components/orders/OrderDeleteDialog.vue', () => ({ default: stub('div') }))
vi.mock('../components/orders/OrderAssignmentDialog.vue', () => ({ default: stub('div') }))
vi.mock('../components/orders/OrderNoteDialog.vue', () => ({ default: stub('div') }))

const order = {
  id: 10,
  order_number: 'ORD-10',
  customer: { id: 9, name: 'Harbor Retail', email: null, phone: null, address: null },
  assignee: { id: 3, name: 'Casey' },
  status: 'confirmed',
  version: 2,
  priority: 'normal',
  order_date: '2026-11-22',
  currency: 'USD',
  subtotal_minor: 1000,
  order_discount_minor: 0,
  discount_total_minor: 0,
  tax_total_minor: 0,
  grand_total_minor: 1000,
  items: [],
  notes: [],
  assignment_history: [],
  system_activity: [],
  status_history: [],
  created_at: '2026-11-22T08:00:00Z',
  completed_at: null,
}

let app
let page

function button(label) {
  return [...page.querySelectorAll('button')].find(
    ({ textContent }) => textContent.trim() === label,
  )
}

async function submitStatus(writeError, readResult) {
  request
    .mockResolvedValueOnce({ data: { order } })
    .mockRejectedValueOnce(writeError)
    .mockImplementationOnce(readResult)
  page = document.createElement('div')
  document.body.append(page)
  app = createApp(OrderDetailView, { orderId: '10' })
  app.mount(page)

  await vi.waitFor(() => expect(button('Change status')).toBeDefined())
  button('Change status').click()
  await vi.waitFor(() => expect(page.querySelector('select')).not.toBeNull())
  const status = page.querySelector('select')
  status.value = 'processing'
  status.dispatchEvent(new Event('change'))
  await vi.waitFor(() => expect(button('Start processing')?.disabled).toBe(false))
  button('Start processing').click()
}

afterEach(() => {
  app?.unmount()
  page?.remove()
  request.mockReset()
})

describe('recovering from a denied order status change', () => {
  it('clears the detail when a scoped status 404 is confirmed by the detail API', async () => {
    const missing = new ApiError('Order not found.', { status: 404 })
    await submitStatus(missing, () => Promise.reject(missing))

    await vi.waitFor(() => expect(page.textContent).toContain('This order is unavailable.'))
    expect(page.textContent).not.toContain('Harbor Retail')
    expect(button('Change status')).toBeUndefined()
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/orders/10',
      '/api/orders/10/status',
      '/api/orders/10',
    ])
  })

  it('refreshes the detail when the status 404 only denies the assigned action', async () => {
    const missing = new ApiError('Order not found.', { status: 404 })
    const latest = { ...order, assignee: { id: 4, name: 'Riley' }, version: 3 }
    await submitStatus(missing, () => Promise.resolve({ data: { order: latest } }))

    await vi.waitFor(() => expect(page.textContent).toContain('Riley'))
    expect(page.textContent).not.toContain('This order is unavailable.')
    expect(button('Change status')).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('keeps refreshed detail when a 403 only denies changing the status', async () => {
    const forbidden = new ApiError('Action forbidden.', { status: 403 })
    const latest = { ...order, status: 'processing', version: 3 }
    await submitStatus(forbidden, () => Promise.resolve({ data: { order: latest } }))

    await vi.waitFor(() => expect(button('Reload order')).toBeDefined())
    expect(page.textContent).toContain('Harbor Retail')
    button('Reload order').click()

    await vi.waitFor(() =>
      expect(page.textContent).toContain('Latest order loaded. Status changes are unavailable.'),
    )
    expect(page.querySelector('select')).toBeNull()
    expect(page.textContent).toContain('Harbor Retail')
    expect(page.querySelector('.detail-title').textContent).toContain('Processing')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('clears the detail if a manual reload confirms lost access after a conflict', async () => {
    const stale = new ApiError('Order changed.', { status: 409, code: 'ORDER_VERSION_CONFLICT' })
    const forbidden = new ApiError('Order forbidden.', { status: 403 })
    await submitStatus(stale, () => Promise.reject(forbidden))

    await vi.waitFor(() => expect(button('Reload order')).toBeDefined())
    button('Reload order').click()

    await vi.waitFor(() =>
      expect(page.textContent).toContain('You do not have permission to view this order.'),
    )
    expect(page.textContent).not.toContain('Harbor Retail')
    expect(button('Change status')).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(3)
  })
})
