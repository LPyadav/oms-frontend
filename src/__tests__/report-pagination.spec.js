import { expect, it, vi } from 'vitest'
import { useReportDirectory } from '../composables/useReportDirectory'

it('requests ten rows per page and preserves the resolved date window across pagination', async () => {
  let currentWindow = { dateFrom: '2026-10-25', dateTo: '2026-11-23' }
  const fetchPage = vi.fn(async ({ dateFrom, dateTo }) =>
    dateFrom && dateTo ? { dateFrom, dateTo } : currentWindow,
  )
  const { signal } = new AbortController()
  const report = useReportDirectory({ fetchPage, signal, initialQuery: { page: 1 } })

  await report.load({ page: 1, customerId: 8 })
  expect(fetchPage.mock.calls[0][0]).toEqual({ page: 1, customerId: 8, perPage: 10 })
  currentWindow = { dateFrom: '2026-10-26', dateTo: '2026-11-24' }

  await report.loadPage(2)
  expect(fetchPage.mock.calls[1][0]).toEqual({
    page: 2,
    perPage: 10,
    customerId: 8,
    dateFrom: '2026-10-25',
    dateTo: '2026-11-23',
  })
  expect(report.result.value).toEqual({ dateFrom: '2026-10-25', dateTo: '2026-11-23' })

  await report.load({ page: 1 })
  expect(fetchPage.mock.calls[2][0]).toEqual({ page: 1, perPage: 10 })
  expect(report.result.value).toEqual(currentWindow)
})

it('exports the resolved report window, prevents duplicate clicks and releases the download URL', async ({
  onTestFinished,
}) => {
  vi.useFakeTimers()
  const csv = new Blob(['Order number,Total'], { type: 'text/csv' })
  const objectUrl = 'blob:http://localhost/report-csv'
  const createObjectURL = vi.fn().mockReturnValue(objectUrl)
  const revokeObjectURL = vi.fn()
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    },
  )
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  onTestFinished(() => {
    click.mockRestore()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const window = { dateFrom: '2026-10-25', dateTo: '2026-11-23' }
  const { signal } = new AbortController()
  const fetchCsv = vi.fn().mockResolvedValue(csv)
  const report = useReportDirectory({
    fetchPage: vi.fn().mockResolvedValue(window),
    fetchCsv,
    fileName: 'sales-tax.csv',
    signal,
    initialQuery: { page: 1 },
  })

  await report.exportReport()
  expect(fetchCsv).not.toHaveBeenCalled()
  await report.load({ page: 1, customerId: 8 })
  const exportRequest = report.exportReport()
  expect(report.exporting.value).toBe(true)
  await report.exportReport()
  await exportRequest

  expect(fetchCsv).toHaveBeenCalledExactlyOnceWith({ page: 1, customerId: 8, ...window }, signal)
  expect(report.exporting.value).toBe(false)
  expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(csv)
  expect(click).toHaveBeenCalledOnce()
  const [link] = click.mock.contexts
  expect(link.download).toBe('sales-tax.csv')
  expect(link.href).toBe(objectUrl)
  expect(link.isConnected).toBe(false)
  await vi.advanceTimersByTimeAsync(1000)
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(objectUrl)
})

it('shows the server export limit and ends the loading state so the request can be retried', async () => {
  const message = 'Narrow the filters before exporting.'
  const fetchCsv = vi.fn().mockRejectedValue({ status: 422, fields: { export: [message] } })
  const { signal } = new AbortController()
  const report = useReportDirectory({
    fetchPage: vi.fn().mockResolvedValue({ dateFrom: '2026-10-25', dateTo: '2026-11-23' }),
    fetchCsv,
    fileName: 'sales-tax.csv',
    signal,
    initialQuery: { page: 1 },
  })

  await report.load()
  await report.exportReport()

  expect(report.exportError.value).toBe(message)
  expect(report.exporting.value).toBe(false)
  expect(report.canExport.value).toBe(true)
})
