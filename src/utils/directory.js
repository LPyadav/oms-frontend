export function formatDirectoryPageRange(page, itemCount, singular, plural) {
  if (!page || !itemCount) return ''

  const { currentPage, perPage, total } = page
  const first = (currentPage - 1) * perPage + 1
  const last = first + itemCount - 1
  const range = first === last ? String(first) : first + '–' + last
  return range + ' of ' + total + ' ' + (total === 1 ? singular : plural)
}

export function getDirectoryErrorMessage(error, fallback, statusMessages) {
  if (error?.status === 429) return 'Too many requests. Try again shortly.'
  return statusMessages[error?.status] ?? fallback
}
