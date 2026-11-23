const timestampFormatters = new Map()

function reportTimestampFormatter(timeZone) {
  if (!timestampFormatters.has(timeZone)) {
    timestampFormatters.set(
      timeZone,
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }),
    )
  }

  return timestampFormatters.get(timeZone)
}

export function isReportTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false

  try {
    reportTimestampFormatter(value)
    return true
  } catch {
    return false
  }
}

export function formatReportTimestamp(value, timeZone) {
  return reportTimestampFormatter(timeZone).format(new Date(value))
}

export function getReportDateErrors(from, to) {
  if (!from && to) return { from: 'Enter a start date.', to: '' }
  if (from && !to) return { from: '', to: 'Enter an end date.' }
  if (from && to < from) return { from: '', to: 'End date must be on or after the start date.' }

  return { from: '', to: '' }
}
