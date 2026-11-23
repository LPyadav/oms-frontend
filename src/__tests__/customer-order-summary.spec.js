import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '../api/client'
import { loadCustomerOrderSummary } from '../api/customers'
import CustomerOrderSummary from '../components/customers/CustomerOrderSummary.vue'
import { formatOrderTotal } from '../utils/orderDisplay'

const { profileRequest, stub } = vi.hoisted(() => ({
  profileRequest: vi.fn(),
  stub: (tag) => ({
    setup(_, { slots }) {
      return () => h(tag, slots.default?.())
    },
  }),
}))

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ request: profileRequest }),
}))
vi.mock('vuetify/components/VAlert', () => ({ VAlert: stub('div') }))
vi.mock('vuetify/components/VBtn', () => ({ VBtn: stub('button') }))
vi.mock('vuetify/components/VChip', () => ({ VChip: stub('span') }))
vi.mock('vuetify/components/VProgressLinear', () => ({ VProgressLinear: stub('div') }))

const summary = {
  total_orders: 3,
  pending_orders: 1,
  completed_orders: 1,
  cancelled_orders: 1,
  total_value_by_currency: [
    { currency: 'EUR', total_minor: '5400' },
    { currency: 'USD', total_minor: '9007199254744291' },
  ],
  recent_orders: [
    {
      id: 42,
      order_number: 'ORD-42',
      order_date: '2026-11-22',
      status: 'pending',
      currency: 'USD',
      grand_total_minor: 2000,
    },
  ],
}

it('loads the dedicated summary and keeps currency totals exact', async () => {
  const { signal } = new AbortController()
  const request = vi.fn().mockResolvedValue({ data: { order_summary: summary } })

  const orderSummary = await loadCustomerOrderSummary(request, 7, signal)

  expect(request).toHaveBeenCalledExactlyOnceWith('/api/customers/7/order-summary', { signal })
  expect(orderSummary).toEqual(summary)
  const amount = formatOrderTotal(orderSummary.total_value_by_currency[1].total_minor, 'USD')
  expect(amount.replace(/[^\d]/g, '')).toBe('9007199254744291')
})

it.each([
  { pending_orders: -1 },
  { total_value_by_currency: [{ currency: 'USD', total_minor: 10 }] },
  { total_value_by_currency: [{ currency: 'USA$', total_minor: '10' }] },
  { recent_orders: [{ ...summary.recent_orders[0], status: 'invalid' }] },
  { recent_orders: [{ ...summary.recent_orders[0], order_date: '2026-02-30' }] },
])('rejects an invalid summary response %j', async (invalid) => {
  const request = vi.fn().mockResolvedValue({ data: { order_summary: { ...summary, ...invalid } } })

  await expect(loadCustomerOrderSummary(request, 7)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('handles an empty summary and rejects an invalid customer ID before requesting', async () => {
  const emptySummary = {
    total_orders: 0,
    pending_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_value_by_currency: [],
    recent_orders: [],
  }
  const request = vi.fn().mockResolvedValue({ data: { order_summary: emptySummary } })

  await expect(loadCustomerOrderSummary(request, 7)).resolves.toEqual(emptySummary)
  await expect(loadCustomerOrderSummary(request, '7/orders')).rejects.toMatchObject({ status: 404 })
  expect(request).toHaveBeenCalledTimes(1)
})

let app
let page

async function mountSummary() {
  const view = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: view },
      { path: '/orders/:orderId', name: 'order-detail', component: view },
    ],
  })
  await router.push('/')
  page = document.createElement('div')
  document.body.append(page)
  app = createApp(CustomerOrderSummary, { customerId: 7 })
  app.use(router)
  app.mount(page)
}

afterEach(() => {
  app?.unmount()
  page?.remove()
  app = null
  page = null
  profileRequest.mockReset()
})

it('shows currency totals and links the recent order to its detail route', async () => {
  profileRequest.mockResolvedValueOnce({ data: { order_summary: summary } })
  await mountSummary()

  await vi.waitFor(() => expect(page.querySelector('a')?.getAttribute('href')).toBe('/orders/42'))
  expect(page.querySelector('a').textContent.trim()).toBe('ORD-42')
  expect(page.textContent).toContain('Total orders')
  expect(page.textContent).toContain('Total order value')
  expect(page.textContent).toContain(formatOrderTotal('5400', 'EUR'))
  expect(page.textContent).toContain(formatOrderTotal('9007199254744291', 'USD'))
})

it('retries a failed summary read and shows the empty history', async () => {
  profileRequest.mockRejectedValueOnce(new ApiError('Unavailable', { status: 500 }))
  profileRequest.mockResolvedValueOnce({
    data: {
      order_summary: {
        total_orders: 0,
        pending_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_value_by_currency: [],
        recent_orders: [],
      },
    },
  })
  await mountSummary()

  await vi.waitFor(() => expect(page.textContent).toContain('Unable to load the order summary.'))
  page.querySelector('button').click()
  await vi.waitFor(() => expect(page.textContent).toContain('No orders to show for this customer.'))
  expect(profileRequest).toHaveBeenCalledTimes(2)
  expect(page.querySelector('a')).toBeNull()
})
