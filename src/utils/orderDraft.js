import { ORDER_PRIORITY } from '../constants/orders'

export const MAX_ORDER_ITEMS = 1000
export const MAX_LINE_QUANTITY = 2_147_483_647
export const MAX_ORDER_NOTE_LENGTH = 10_000

export function createOrderLine(key) {
  return { key, product: null, quantity: '1', discount: '' }
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

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01') return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

export function validateOrderDraft(draft) {
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

  const selectedProducts = new Set()
  const items = draft.items.map((line, index) => {
    const path = 'items.' + index
    const productId = line.product?.id
    const quantity = Number(line.quantity)
    const discount = discountToMinor(line.discount)
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

    return { product_id: productId, quantity, item_discount_minor: discount }
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
      items,
    },
  }
}

export function orderFieldStep(field) {
  if (field === 'customer_id') return 0
  if (field === 'order_discount_minor' || field === 'items' || field.startsWith('items.')) return 1
  if (['order_date', 'priority', 'assignee_id', 'note'].includes(field)) return 2
  return 3
}
