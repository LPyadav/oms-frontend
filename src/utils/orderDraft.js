import { MAX_TAX_RATE_BASIS_POINTS, ORDER_PRIORITY } from '../constants/orders'

export const MAX_ORDER_ITEMS = 1000
export const MAX_LINE_QUANTITY = 2_147_483_647
export const MAX_ORDER_NOTE_LENGTH = 10_000

export function createOrderLine(key) {
  return { key, product: null, quantity: '1', discount: '', taxRate: '' }
}

export function todayForOrder() {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function discountToMinor(value) {
  const input = String(value ?? '').trim()
  if (!input) return 0
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) return null
  const [whole, fraction = ''] = input.split('.')
  const minor = Number(whole + fraction.padEnd(2, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

export function taxRateToBasisPoints(value) {
  const input = String(value ?? '').trim()
  if (!input) return undefined
  const points = discountToMinor(input)
  return points !== null && points <= MAX_TAX_RATE_BASIS_POINTS ? points : null
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01') return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

export function usesOrderTaxSetting(draft, savedOrderTaxRate) {
  return Boolean(draft.orderTaxRate?.trim()) || savedOrderTaxRate != null
}

export function validateOrderDraft(
  draft,
  { allowTaxOverride = true, savedOrderTaxRate = null } = {},
) {
  const fields = {}

  if (!draft.customer) fields.customer_id = 'Select a customer.'
  if (!isValidDate(draft.orderDate)) fields.order_date = 'Enter a valid order date.'
  if (!Object.hasOwn(ORDER_PRIORITY, draft.priority)) fields.priority = 'Select a priority.'
  if (draft.note.length > MAX_ORDER_NOTE_LENGTH) {
    fields.note = `Enter at most ${MAX_ORDER_NOTE_LENGTH} characters.`
  }
  if (!draft.items.length || draft.items.length > MAX_ORDER_ITEMS) {
    fields.items = `Enter between 1 and ${MAX_ORDER_ITEMS} items.`
  }

  const orderDiscount = discountToMinor(draft.discount)
  if (orderDiscount === null)
    fields.order_discount_minor = 'Enter a valid amount with up to two decimals.'

  const orderTaxInput = allowTaxOverride ? taxRateToBasisPoints(draft.orderTaxRate) : undefined
  const useOrderTax = allowTaxOverride && usesOrderTaxSetting(draft, savedOrderTaxRate)
  if (orderTaxInput === null) {
    fields.order_tax_rate_basis_points = 'Enter a tax rate from 0 to 100 with up to two decimals.'
  }

  const selectedProducts = new Set()
  const items = draft.items.map((line, index) => {
    const path = 'items.' + index
    const productId = line.product?.id
    const quantity = Number(line.quantity)
    const discount = discountToMinor(line.discount)
    const taxRate =
      allowTaxOverride && !useOrderTax ? taxRateToBasisPoints(line.taxRate) : undefined
    if (!productId) fields[path + '.product_id'] = 'Select a product.'
    else if (selectedProducts.has(productId)) {
      fields[path + '.product_id'] =
        'This product is already on the order. Change its quantity above.'
    }
    selectedProducts.add(productId)
    if (!/^\d+$/.test(String(line.quantity)) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
      fields[path + '.quantity'] = 'Enter a positive whole quantity within the allowed range.'
    }
    if (discount === null)
      fields[path + '.item_discount_minor'] = 'Enter a valid amount with up to two decimals.'

    if (taxRate === null) {
      fields[path + '.tax_rate_basis_points'] =
        'Enter a tax rate from 0 to 100 with up to two decimals.'
    }
    return {
      product_id: productId,
      quantity,
      item_discount_minor: discount,
      ...(Number.isInteger(taxRate) && { tax_rate_basis_points: taxRate }),
    }
  })

  return {
    fields,
    body: {
      customer_id: draft.customer?.id,
      order_date: draft.orderDate,
      priority: draft.priority,
      ...(draft.assignee && { assignee_id: draft.assignee.id }),
      ...(draft.note.trim() && { note: draft.note.trim() }),
      order_discount_minor: orderDiscount,
      ...(useOrderTax &&
        orderTaxInput !== null && { order_tax_rate_basis_points: orderTaxInput ?? null }),
      items,
    },
  }
}

export function orderFieldStep(field) {
  if (field === 'customer_id') return 0
  if (
    ['order_discount_minor', 'order_tax_rate_basis_points', 'items'].includes(field) ||
    field.startsWith('items.')
  )
    return 1
  if (['order_date', 'priority', 'assignee_id', 'note'].includes(field)) return 2
  return 3
}

const editableFields = {
  customer_id: 'customer',
  items: 'items',
  order_discount_minor: 'discount',
  order_tax_rate_basis_points: 'orderTaxRate',
  order_date: 'orderDate',
  priority: 'priority',
}

function decimalInput(amount) {
  const digits = String(amount).padStart(3, '0')
  return digits.slice(0, -2) + '.' + digits.slice(-2)
}

const discountInput = (amount) => (amount === 0 ? '' : decimalInput(amount))

export function createOrderDraft(order = null) {
  return {
    customer: order?.customer ?? null,
    items: order
      ? order.items.map((item, index) => ({
          key: index + 1,
          product: { id: item.product_id, name: item.product_name, sku: item.product_sku },
          quantity: String(item.quantity),
          discount: discountInput(item.item_discount_minor),
          taxRate: '',
        }))
      : [createOrderLine(1)],
    orderTaxRate:
      order?.order_tax_rate_basis_points == null
        ? ''
        : decimalInput(order.order_tax_rate_basis_points),
    orderDate: order?.order_date ?? todayForOrder(),
    priority: order?.priority ?? 'normal',
    assignee: null,
    note: '',
    discount: order ? discountInput(order.order_discount_minor) : '',
  }
}

function savedOrderFields(order) {
  return {
    customer_id: order.customer.id,
    items: order.items.map(
      ({ product_id, quantity, item_discount_minor, tax_rate_basis_points }) => ({
        product_id,
        quantity,
        item_discount_minor,
        tax_rate_basis_points,
      }),
    ),
    order_discount_minor: order.order_discount_minor,
    order_tax_rate_basis_points: order.order_tax_rate_basis_points ?? null,
    order_date: order.order_date,
    priority: order.priority,
  }
}

// Both sources use the same normalized line shape and item order is significant.
const fieldsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

function comparableOrderField(field, value, saved) {
  if (field !== 'items') return value

  const savedRates = new Map(
    saved.items.map((line) => [line.product_id, line.tax_rate_basis_points]),
  )
  return value.map((line) => ({
    ...line,
    tax_rate_basis_points: line.tax_rate_basis_points ?? savedRates.get(line.product_id),
  }))
}

export function changedOrderFields(order, body) {
  const original = savedOrderFields(order)
  return Object.fromEntries(
    Object.keys(editableFields)
      .filter(
        (field) =>
          Object.hasOwn(body, field) &&
          !fieldsEqual(original[field], comparableOrderField(field, body[field], original)),
      )
      .map((field) => [field, body[field]]),
  )
}

export function orderEditConflicts(original, latest, changes) {
  const originalFields = savedOrderFields(original)
  const latestFields = savedOrderFields(latest)
  return Object.keys(changes).filter((field) => {
    if (
      field === 'items' &&
      latestFields.order_tax_rate_basis_points !== null &&
      !Object.hasOwn(changes, 'order_tax_rate_basis_points') &&
      changes.items.some((item) => Object.hasOwn(item, 'tax_rate_basis_points'))
    ) {
      return true
    }

    return (
      !fieldsEqual(originalFields[field], latestFields[field]) &&
      !fieldsEqual(comparableOrderField(field, changes[field], originalFields), latestFields[field])
    )
  })
}

export function reapplyOrderChanges(latest, draft, changes) {
  const next = createOrderDraft(latest)
  for (const field of Object.keys(changes)) {
    const key = editableFields[field]
    next[key] = draft[key]
  }
  return next
}
