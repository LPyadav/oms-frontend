export function isCsvBlob(value) {
  return value instanceof Blob && value.type.split(';', 1)[0] === 'text/csv'
}

export function downloadCsv(csv, fileName) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(csv)
  link.href = url
  link.download = fileName
  try {
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
