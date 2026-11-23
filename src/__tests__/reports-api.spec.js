import { expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { loadOrderFulfillmentReport } from '../api/reports'
import { formatOrderTotal } from '../utils/orderDisplay'

const order = {
  id: 48,
  order_number: 'ORD-TEST-48',
  order_date: '2026-11-23',
  customer: { id: 8, name: 'Harbor Retail' },
  priority: 'high',
  status: 'completed',
  assignee: { id: 3, name: 'Morgan Lane' },
  currency: 'USD',
  grand_total_minor: Number.MAX_SAFE_INTEGER,
}
const totals = {
  order_count: 3,
  by_currency: [
    { currency: 'EUR', order_count: 1, grand_total_minor: '12950' },
    { currency: 'USD', order_count: 2, grand_total_minor: '18014398509481982' },
  ],
}
const dateFrom = '2026-11-01'
const dateTo = '2026-11-23'
const snapshotAt = '2026-11-24T01:23:45.000000Z'

function envelope({ orders = [order], summary = totals, meta = {} } = {}) {
  return {
    success: true,
    data: { orders, totals: summary },
    meta: {
      current_page: 1,
      per_page: 1,
      total: 3,
      last_page: 3,
      snapshot_at: snapshotAt,
      date_from: dateFrom,
      date_to: dateTo,
      ...meta,
    },
  }
}

it('sends fulfillment filters and preserves the snapshot and currency totals across all pages', async () => {
  const request = vi.fn().mockResolvedValue(envelope({ meta: { current_page: 2 } }))
  const { signal } = new AbortController()

  const report = await loadOrderFulfillmentReport(
    request,
    { page: 2, perPage: 1, dateFrom, dateTo, status: 'completed', customerId: 8, assigneeId: 3 },
    signal,
  )

  const [[url, options]] = request.mock.calls
  const parsed = new URL(url, 'http://localhost')
  expect(parsed.pathname).toBe('/api/reports/orders')
  expect(Object.fromEntries(parsed.searchParams)).toEqual({
    page: '2',
    per_page: '1',
    date_from: dateFrom,
    date_to: dateTo,
    status: 'completed',
    customer_id: '8',
    assignee_id: '3',
  })
  expect(options).toEqual({ signal })
  expect(report).toEqual({
    orders: [order],
    totals,
    currentPage: 2,
    perPage: 1,
    lastPage: 3,
    total: 3,
    dateFrom,
    dateTo,
    snapshotAt,
  })

  const wholeReportUsd = report.totals.by_currency[1]
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: wholeReportUsd.currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  expect(formatOrderTotal(wholeReportUsd.grand_total_minor, wholeReportUsd.currency)).toBe(
    formatter.format('180143985094819.82'),
  )
})

it('omits unset filters and accepts an empty default date range', async () => {
  const empty = envelope({
    orders: [],
    summary: { order_count: 0, by_currency: [] },
    meta: { per_page: 25, total: 0, last_page: 1 },
  })
  const request = vi.fn().mockResolvedValue(empty)

  await expect(
    loadOrderFulfillmentReport(request, {
      page: 1,
      dateFrom: '',
      dateTo: '',
      status: '',
      customerId: null,
      assigneeId: null,
    }),
  ).resolves.toMatchObject({
    orders: [],
    totals: { order_count: 0, by_currency: [] },
    total: 0,
    currentPage: 1,
    perPage: 25,
    lastPage: 1,
    dateFrom,
    dateTo,
  })
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/reports/orders?page=1', {
    signal: undefined,
  })
})

it('preserves filtered totals when the requested page no longer exists', async () => {
  const request = vi.fn().mockResolvedValue(envelope({ orders: [], meta: { current_page: 4 } }))

  await expect(loadOrderFulfillmentReport(request, { page: 4 })).resolves.toMatchObject({
    orders: [],
    totals,
    total: 3,
    currentPage: 4,
    lastPage: 3,
  })
})

it.each([
  ['an unrelated page', envelope({ meta: { current_page: 2 } })],
  ['a missing snapshot', envelope({ meta: { snapshot_at: null } })],
  ['an impossible date', envelope({ meta: { date_from: '2026-02-30' } })],
  ['a reversed date range', envelope({ meta: { date_to: '2026-10-31' } })],
  ['a mismatched order count', envelope({ summary: { ...totals, order_count: 2 } })],
  [
    'unaccounted order counts',
    envelope({ summary: { ...totals, by_currency: [totals.by_currency[0]] } }),
  ],
  [
    'duplicate currency buckets',
    envelope({
      summary: {
        ...totals,
        by_currency: [totals.by_currency[0], { ...totals.by_currency[1], currency: 'EUR' }],
      },
    }),
  ],
  [
    'a numeric currency total',
    envelope({
      summary: {
        ...totals,
        by_currency: [
          { ...totals.by_currency[0], grand_total_minor: 12950 },
          totals.by_currency[1],
        ],
      },
    }),
  ],
  [
    'a malformed order row',
    envelope({ orders: [{ ...order, assignee: { id: 0, name: 'Unknown' } }] }),
  ],
])('rejects %s', async (_, response) => {
  const request = vi.fn().mockResolvedValue(response)

  await expect(loadOrderFulfillmentReport(request, { page: 1 })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('passes backend field errors through to the report filters', async () => {
  const failure = new ApiError('Invalid report filters.', {
    status: 422,
    code: 'VALIDATION_FAILED',
    fields: { date_to: ['The date range is too long.'] },
  })
  const request = vi.fn().mockRejectedValue(failure)

  await expect(loadOrderFulfillmentReport(request, { page: 1, dateFrom })).rejects.toBe(failure)
})
