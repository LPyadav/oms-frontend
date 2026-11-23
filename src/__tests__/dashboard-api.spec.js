import { describe, expect, it, vi } from 'vitest'
import { loadDashboardOverview, loadDashboardTrend } from '../api/dashboard'
import { formatOrderTotal } from '../utils/orderDisplay'

const revenueMinor = '9232379236109515775'
const overview = {
  total_orders: 1026,
  orders_by_status: {
    draft: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    ready: 1,
    completed: 1025,
    cancelled: 0,
  },
  total_customers: null,
  total_products: 0,
  financial_metrics: [
    {
      currency: 'USD',
      completed_orders: 1025,
      total_revenue_minor: revenueMinor,
      average_order_value_minor: Number.MAX_SAFE_INTEGER,
    },
  ],
  recent_orders: [
    {
      id: 10,
      order_number: 'ORD-10',
      order_date: '2026-11-23',
      status: 'ready',
      priority: 'normal',
      currency: 'USD',
      grand_total_minor: 0,
    },
  ],
}

const revenuePoint = {
  period_start: '2026-11-20',
  period_end: '2026-11-22',
  revenue_minor: revenueMinor,
  completed_orders: 1025,
}
const zeroPoint = {
  period_start: '2026-11-23',
  period_end: '2026-11-24',
  revenue_minor: '0',
  completed_orders: 1,
}
const trend = {
  group_by: 'week',
  timezone: 'Asia/Kolkata',
  date_from: '2026-11-20',
  date_to: '2026-11-24',
  series: [
    { currency: 'USD', points: [revenuePoint, zeroPoint] },
    {
      currency: 'EUR',
      points: [{ ...revenuePoint, revenue_minor: '0', completed_orders: 0 }, zeroPoint],
    },
  ],
}
const query = { group: 'week', dateFrom: '2026-11-20', dateTo: '2026-11-24' }

function requestFor(data) {
  return vi.fn().mockResolvedValue({
    success: true,
    data,
    errors: null,
    meta: null,
  })
}

describe('Dashboard overview API', () => {
  it('preserves exact revenue and distinguishes a restricted catalog count from zero', async () => {
    const request = requestFor(overview)
    const { signal } = new AbortController()
    const loaded = await loadDashboardOverview(request, signal)

    expect(request).toHaveBeenCalledExactlyOnceWith('/api/dashboard', { signal })
    expect(loaded).toEqual(overview)
    expect(loaded.total_customers).toBeNull()
    expect(loaded.total_products).toBe(0)

    const metric = loaded.financial_metrics[0]
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    expect(metric.total_revenue_minor).toBe(revenueMinor)
    expect(formatOrderTotal(metric.total_revenue_minor, metric.currency)).toBe(
      formatter.format('92323792361095157.75'),
    )
  })

  it.each([
    ['missing data', null],
    ['incomplete status counts', { ...overview, orders_by_status: { draft: 0 } }],
    ['invalid customer count', { ...overview, total_customers: '0' }],
    [
      'numeric revenue total',
      {
        ...overview,
        financial_metrics: [{ ...overview.financial_metrics[0], total_revenue_minor: 1000 }],
      },
    ],
    [
      'invalid recent order date',
      { ...overview, recent_orders: [{ ...overview.recent_orders[0], order_date: '2026-02-30' }] },
    ],
  ])('rejects %s in the overview response', async (_, data) => {
    await expect(loadDashboardOverview(requestFor(data))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })
})

describe('Dashboard revenue trend API', () => {
  it('sends the selected group and inclusive dates and preserves currency series', async () => {
    const request = requestFor(trend)
    const { signal } = new AbortController()
    const loaded = await loadDashboardTrend(request, query, signal)

    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/api/dashboard/revenue-trend?group_by=week&date_from=2026-11-20&date_to=2026-11-24',
      { signal },
    )
    expect(loaded).toEqual(trend)
    expect(loaded.series[0].points[0].revenue_minor).toBe(revenueMinor)
    expect(loaded.series[0].points[1]).toMatchObject({ revenue_minor: '0', completed_orders: 1 })
    expect(loaded.series[1].points[0]).toMatchObject({ revenue_minor: '0', completed_orders: 0 })
  })

  it('lets Laravel choose the default date range when dates are absent', async () => {
    const empty = {
      group_by: 'day',
      timezone: 'UTC',
      date_from: '2026-11-23',
      date_to: '2026-11-23',
      series: [
        {
          currency: 'USD',
          points: [
            {
              period_start: '2026-11-23',
              period_end: '2026-11-23',
              revenue_minor: '0',
              completed_orders: 0,
            },
          ],
        },
      ],
    }
    const request = requestFor(empty)

    await expect(loadDashboardTrend(request, { group: 'day' })).resolves.toEqual(empty)
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/dashboard/revenue-trend?group_by=day', {
      signal: undefined,
    })
  })

  it.each([
    ['missing data', null],
    ['mismatched grouping', { ...trend, group_by: 'month' }],
    ['reversed date range', { ...trend, date_from: '2026-11-25' }],
    ['missing time zone', { ...trend, timezone: '' }],
    [
      'non-integer revenue',
      {
        ...trend,
        series: [{ currency: 'USD', points: [{ ...revenuePoint, revenue_minor: '5.5' }] }],
      },
    ],
    [
      'reversed bucket dates',
      {
        ...trend,
        series: [{ currency: 'USD', points: [{ ...revenuePoint, period_end: '2026-11-19' }] }],
      },
    ],
  ])('rejects %s in the trend response', async (_, data) => {
    await expect(loadDashboardTrend(requestFor(data), query)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })
})
