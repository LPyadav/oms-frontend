import { expect, it, vi } from 'vitest'
import { loadOrderFilterPartyPage, loadOrderPage, loadOrdersCsv } from '../api/orders'
import { usePagedDirectory } from '../composables/usePagedDirectory'
import { FIRST_ORDER_PAGE } from '../constants/orders'
import { formatOrderDate, formatOrderTotal } from '../utils/orderDisplay'

const order = {
  id: 48,
  order_number: 'ORD-TEST-48',
  customer: { id: 8, name: 'Harbor Retail' },
  assignee: { id: 3, name: 'Morgan Lane' },
  order_date: '2026-11-22',
  status: 'ready',
  priority: 'high',
  currency: 'USD',
  grand_total_minor: 14580,
}

function envelope(orders = [order], meta = {}) {
  return {
    data: { orders },
    meta: { current_page: 1, per_page: 25, total: 1, last_page: 1, ...meta },
  }
}

it('sends Laravel search, filter, sort and page parameters', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(envelope([order], { current_page: 2, per_page: 3, total: 6, last_page: 2 }))
  const { signal } = new AbortController()

  await expect(
    loadOrderPage(
      request,
      {
        ...FIRST_ORDER_PAGE,
        page: 2,
        search: '100%_Packing',
        status: 'ready',
        priority: 'high',
        customerId: 8,
        assigneeId: 3,
        dateFrom: '2026-11-01',
        dateTo: '2026-11-30',
        sort: 'total',
        direction: 'asc',
      },
      signal,
    ),
  ).resolves.toEqual({ orders: [order], currentPage: 2, perPage: 3, total: 6, lastPage: 2 })

  const [[url, options]] = request.mock.calls
  const parsed = new URL(url, 'http://localhost')
  expect(parsed.pathname).toBe('/api/orders')
  expect(Object.fromEntries(parsed.searchParams)).toEqual({
    page: '2',
    sort: 'total',
    direction: 'asc',
    search: '100%_Packing',
    status: 'ready',
    priority: 'high',
    customer_id: '8',
    assignee_id: '3',
    date_from: '2026-11-01',
    date_to: '2026-11-30',
  })
  expect(options).toEqual({ signal })
})

it('offers matching customers from visible orders without exposing contact fields', async () => {
  const namedCustomer = { id: 8, name: 'Harbór Retail', email: 'contact@example.test' }
  const sameName = { id: 18, name: 'Harbor Retail' }
  const request = vi.fn().mockResolvedValue(
    envelope(
      [
        { ...order, customer: namedCustomer },
        { ...order, id: 49, customer: namedCustomer },
        { ...order, id: 50, customer: sameName },
        { ...order, id: 51, customer: { id: 21, name: 'Other Customer' } },
      ],
      { current_page: 2, last_page: 4 },
    ),
  )
  const { signal } = new AbortController()

  await expect(
    loadOrderFilterPartyPage(request, 'customer', { page: 2, search: 'Harbor' }, signal),
  ).resolves.toEqual({
    parties: [
      { id: 8, name: 'Harbór Retail' },
      { id: 18, name: 'Harbor Retail' },
    ],
    lastPage: 4,
  })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/orders?page=2&sort=order_date&direction=desc&search=Harbor',
    { signal },
  )
})

it('keeps assignee lookup pagination when the current page has no match', async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      envelope([order, { ...order, id: 49, assignee: null }], { current_page: 1, last_page: 3 }),
    )

  await expect(
    loadOrderFilterPartyPage(request, 'assignee', { page: 1, search: 'Maya' }),
  ).resolves.toEqual({ parties: [], lastPage: 3 })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/orders?page=1&sort=order_date&direction=desc&search=Maya',
    { signal: undefined },
  )
})

it('honors default server page size and accepts unassigned orders with zero total', async () => {
  const draft = { ...order, status: 'draft', assignee: null, grand_total_minor: 0 }
  const request = vi.fn().mockResolvedValue(envelope([draft], { per_page: 4 }))

  await expect(loadOrderPage(request, FIRST_ORDER_PAGE)).resolves.toMatchObject({
    orders: [draft],
    perPage: 4,
  })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/orders?page=1&sort=order_date&direction=desc',
    { signal: undefined },
  )
})

it.each([
  envelope([{ ...order, status: 'archived' }]),
  envelope([{ ...order, order_date: '2026-02-30' }]),
  envelope([{ ...order, currency: 'USDollars' }]),
  envelope([{ ...order, grand_total_minor: '14580' }]),
  envelope([{ ...order, grand_total_minor: Number.MAX_SAFE_INTEGER + 1 }]),
  envelope([{ ...order, customer: null }]),
  envelope([order], { per_page: 0 }),
  envelope([order], { current_page: 2 }),
])('rejects an invalid page (%j)', async (response) => {
  const request = vi.fn().mockResolvedValue(response)
  await expect(loadOrderPage(request, FIRST_ORDER_PAGE)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('keeps date-only values in UTC and formats the returned currency and minor units exactly', () => {
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
  const currency = (code) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

  expect(formatOrderDate('2026-11-22')).toBe(date.format(new Date('2026-11-22T00:00:00Z')))
  expect(formatOrderTotal(14580, 'USD')).toBe(currency('USD').format(145.8))
  expect(formatOrderTotal(0, 'EUR')).toBe(currency('EUR').format(0))
  expect(formatOrderTotal(Number.MAX_SAFE_INTEGER, 'USD')).toBe(
    currency('USD').format('90071992547409.91'),
  )
})

it('does not let a stale order request replace a newer filtered result', async () => {
  const old = Promise.withResolvers()
  const latest = { ...order, id: 52, order_number: 'ORD-NEW' }
  const request = vi
    .fn()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(envelope([latest]))
  const controller = new AbortController()
  const directory = usePagedDirectory({
    initialQuery: FIRST_ORDER_PAGE,
    fetchPage: (query, signal) => loadOrderPage(request, query, signal),
    signal: controller.signal,
  })

  const earlier = directory.load()
  await directory.load({ ...FIRST_ORDER_PAGE, status: 'ready', search: 'Harbor' })
  expect(request.mock.calls[0][1].signal.aborted).toBe(true)
  old.resolve(envelope())
  await earlier

  expect(directory.result.value.orders).toEqual([latest])
  expect(directory.query.value.search).toBe('Harbor')
  expect(directory.loading.value).toBe(false)
})

it('exports the applied order query without its page number', async () => {
  const csv = new Blob(['Order number,Total'], { type: 'text/csv; charset=UTF-8' })
  const request = vi.fn().mockResolvedValue(csv)
  const { signal } = new AbortController()

  await expect(
    loadOrdersCsv(
      request,
      { ...FIRST_ORDER_PAGE, page: 3, search: 'Stock 100%', customerId: 8, sort: 'total' },
      signal,
    ),
  ).resolves.toBe(csv)
  const [[url, options]] = request.mock.calls
  const parsed = new URL(url, 'http://localhost')
  expect(parsed.pathname).toBe('/api/orders/export')
  expect(Object.fromEntries(parsed.searchParams)).toEqual({
    sort: 'total',
    direction: 'desc',
    search: 'Stock 100%',
    customer_id: '8',
  })
  expect(options).toEqual({ responseType: 'blob', signal })
})

it('rejects an unexpected content type before creating a CSV download', async () => {
  const request = vi.fn().mockResolvedValue(new Blob(['<html>'], { type: 'text/html' }))

  await expect(loadOrdersCsv(request, FIRST_ORDER_PAGE)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
