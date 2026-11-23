import { expect, it, vi } from 'vitest'
import { useReportDirectory } from '../composables/useReportDirectory'

it('preserves the resolved window across reporting midnight until filters are submitted again', async () => {
  let currentWindow = { dateFrom: '2026-10-25', dateTo: '2026-11-23' }
  const fetchPage = vi.fn(async ({ dateFrom, dateTo }) =>
    dateFrom && dateTo ? { dateFrom, dateTo } : currentWindow,
  )
  const { signal } = new AbortController()
  const report = useReportDirectory({ fetchPage, signal, initialQuery: { page: 1 } })

  await report.load({ page: 1, customerId: 8 })
  currentWindow = { dateFrom: '2026-10-26', dateTo: '2026-11-24' }

  await report.loadPage(2)
  expect(fetchPage.mock.calls[1][0]).toEqual({
    page: 2,
    customerId: 8,
    dateFrom: '2026-10-25',
    dateTo: '2026-11-23',
  })
  expect(report.result.value).toEqual({ dateFrom: '2026-10-25', dateTo: '2026-11-23' })

  await report.load({ page: 1 })
  expect(fetchPage.mock.calls[2][0]).toEqual({ page: 1 })
  expect(report.result.value).toEqual(currentWindow)
})
