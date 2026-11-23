import { usePagedDirectory } from './usePagedDirectory'

export function useReportDirectory(options) {
  const directory = usePagedDirectory(options)

  function loadPage(page) {
    if (!directory.result.value) return null

    const { dateFrom, dateTo } = directory.result.value
    return directory.load({ ...directory.query.value, page, dateFrom, dateTo })
  }

  return { ...directory, loadPage }
}
