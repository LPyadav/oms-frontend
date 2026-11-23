import { expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { loadSalesTaxReport } from '../api/reports'
import { formatOrderTotal } from '../utils/orderDisplay'
import { formatReportTimestamp } from '../utils/reportDates'

const order = {
  id: 48,
  order_number: 'ORD-TEST-48',
  completed_at: '2026-11-22T18:45:00.000000Z',
  customer: { id: 8, name: 'Harbor Retail' },
  currency: 'USD',
  subtotal_minor: Number.MAX_SAFE_INTEGER,
  item_discount_minor: 50,
  order_discount_minor: 25,
  net_total_minor: 9007199254740916,
  tax_total_minor: 50,
  grand_total_minor: 9007199254740966,
}
const totals = {
  order_count: 3,
  by_currency: [
    {
      currency: 'EUR',
      order_count: 1,
      subtotal_minor: '12950',
      item_discount_minor: '500',
      order_discount_minor: '250',
      net_total_minor: '12200',
      tax_total_minor: '2440',
      grand_total_minor: '14640',
    },
    {
      currency: 'USD',
      order_count: 2,
      subtotal_minor: '18014398509481982',
      item_discount_minor: '100',
      order_discount_minor: '50',
      net_total_minor: '18014398509481832',
      tax_total_minor: '100',
      grand_total_minor: '18014398509481932',
    },
  ],
}
const dateFrom = '2026-11-01'
const dateTo = '2026-11-23'
const snapshotAt = '2026-11-23T02:01:30.000000Z'
const timezone = 'Asia/Kolkata'

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
      timezone,
      ...meta,
    },
  }
}

it('sends completed-date filters and preserves exact all-pages amounts for each currency', async () => {
  const request = vi.fn().mockResolvedValue(envelope({ meta: { current_page: 2 } }))
  const { signal } = new AbortController()

  const report = await loadSalesTaxReport(
    request,
    { page: 2, perPage: 1, dateFrom, dateTo, customerId: 8, productId: 12 },
    signal,
  )

  const [[url, options]] = request.mock.calls
  const parsed = new URL(url, 'http://localhost')
  expect(parsed.pathname).toBe('/api/reports/sales-tax')
  expect(Object.fromEntries(parsed.searchParams)).toEqual({
    page: '2',
    per_page: '1',
    date_from: dateFrom,
    date_to: dateTo,
    customer_id: '8',
    product_id: '12',
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
    timezone,
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
    formatter.format('180143985094819.32'),
  )
})

it('omits unset filters and accepts an empty default range', async () => {
  const request = vi.fn().mockResolvedValue(
    envelope({
      orders: [],
      summary: { order_count: 0, by_currency: [] },
      meta: { per_page: 25, total: 0, last_page: 1 },
    }),
  )

  await expect(
    loadSalesTaxReport(request, {
      page: 1,
      dateFrom: '',
      dateTo: '',
      customerId: null,
      productId: null,
    }),
  ).resolves.toMatchObject({
    orders: [],
    totals: { order_count: 0, by_currency: [] },
    dateFrom,
    dateTo,
    timezone,
  })
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/reports/sales-tax?page=1', {
    signal: undefined,
  })
})

it('preserves totals and the resolved dates when the requested page is out of range', async () => {
  const request = vi.fn().mockResolvedValue(envelope({ orders: [], meta: { current_page: 4 } }))

  await expect(loadSalesTaxReport(request, { page: 4 })).resolves.toMatchObject({
    orders: [],
    totals,
    total: 3,
    currentPage: 4,
    lastPage: 3,
    dateFrom,
    dateTo,
    timezone,
  })
})

it.each([
  ['a missing completion instant', envelope({ orders: [{ ...order, completed_at: null }] })],
  ['an invalid row amount', envelope({ orders: [{ ...order, tax_total_minor: '50' }] })],
  [
    'a malformed aggregate amount',
    envelope({
      summary: {
        ...totals,
        by_currency: [totals.by_currency[0], { ...totals.by_currency[1], net_total_minor: '12.5' }],
      },
    }),
  ],
  [
    'a missing aggregate amount',
    envelope({
      summary: {
        ...totals,
        by_currency: [
          totals.by_currency[0],
          { ...totals.by_currency[1], item_discount_minor: undefined },
        ],
      },
    }),
  ],
  ['an invalid reporting timezone', envelope({ meta: { timezone: 'Asia/Unknown' } })],
  ['a missing reporting timezone', envelope({ meta: { timezone: null } })],
])('rejects %s in the Sales & Tax response', async (_, response) => {
  const request = vi.fn().mockResolvedValue(response)

  await expect(loadSalesTaxReport(request, { page: 1 })).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('formats completion on the reporting day across a UTC date boundary', () => {
  const reportingMidnight = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })

  expect(formatReportTimestamp(order.completed_at, timezone)).toBe(
    reportingMidnight.format(new Date('2026-11-23T00:15:00Z')),
  )
  expect(formatReportTimestamp(order.completed_at, 'UTC')).not.toBe(
    formatReportTimestamp(order.completed_at, timezone),
  )
})

it('passes backend validation errors through to the report filters', async () => {
  const failure = new ApiError('Invalid filters.', {
    status: 422,
    code: 'VALIDATION_FAILED',
    fields: { date_to: ['The date range is too long.'] },
  })
  const request = vi.fn().mockRejectedValue(failure)

  await expect(loadSalesTaxReport(request, { page: 1, dateFrom })).rejects.toBe(failure)
})
