import { computed, ref } from 'vue'
import { downloadCsv } from '../utils/csv'
import { getDirectoryErrorMessage } from '../utils/directory'
import { usePagedDirectory } from './usePagedDirectory'

export function useReportDirectory({ fetchCsv, fileName, ...options }) {
  const directory = usePagedDirectory(options)
  const { signal } = options
  const exporting = ref(false)
  const exportError = ref('')
  const canExport = computed(
    () =>
      !!directory.result.value &&
      !directory.error.value &&
      !directory.loading.value &&
      !exporting.value,
  )

  function appliedQuery() {
    const { dateFrom, dateTo } = directory.result.value
    return { ...directory.query.value, dateFrom, dateTo }
  }

  function loadPage(page) {
    if (!directory.result.value) return null

    return directory.load({ ...appliedQuery(), page })
  }

  async function exportReport() {
    if (signal.aborted || !canExport.value) return

    exporting.value = true
    exportError.value = ''
    try {
      const csv = await fetchCsv(appliedQuery(), signal)
      if (signal.aborted) return

      downloadCsv(csv, fileName)
    } catch (failure) {
      if (signal.aborted || failure?.status === 401) return

      exportError.value =
        failure?.fields?.export?.[0] ??
        getDirectoryErrorMessage(failure, 'Unable to export the report. Try again.', {
          403: 'You do not have permission to export this report.',
        })
    } finally {
      exporting.value = false
    }
  }

  return { ...directory, loadPage, canExport, exporting, exportError, exportReport }
}
