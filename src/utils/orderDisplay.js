const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
const moneyFormatters = new Map()

export function formatOrderDate(value) {
  return dateFormatter.format(new Date(value + 'T00:00:00Z'))
}

export function formatOrderTotal(amountMinor, currency) {
  if (!moneyFormatters.has(currency)) {
    moneyFormatters.set(
      currency,
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
  }

  // The API uses two-decimal minor units. Keep the decimal exact for Intl.
  const digits = String(amountMinor).padStart(3, '0')
  const amount = digits.slice(0, -2) + '.' + digits.slice(-2)
  return moneyFormatters.get(currency).format(amount)
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const taxRateFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 2,
})

export function formatOrderTimestamp(value) {
  return timestampFormatter.format(new Date(value))
}

export function formatOrderTaxRate(basisPoints) {
  return taxRateFormatter.format(basisPoints / 10_000)
}
