export const operationalAuditActions = Object.freeze({
  'order.created': 'Order created',
  'order.updated': 'Order updated',
  'order.deleted': 'Order deleted',
  'order.status_changed': 'Order status changed',
  'order.assigned': 'Order assignment changed',
  'order.note_added': 'Order note added',
  'customer.created': 'Customer created',
  'customer.updated': 'Customer updated',
  'customer.deactivated': 'Customer deactivated',
  'product.created': 'Product created',
  'product.updated': 'Product updated',
  'product.deactivated': 'Product deactivated',
  'product.stock_adjusted': 'Product stock adjusted',
})

const auditFields = {
  order_number: 'Order number',
  customer_id: 'Customer ID',
  assignee_id: 'Assigned employee ID',
  order_date: 'Order date',
  priority: 'Priority',
  status: 'Status',
  currency: 'Currency',
  subtotal_minor: 'Subtotal (minor units)',
  order_discount_minor: 'Order discount (minor units)',
  discount_total_minor: 'Total discount (minor units)',
  order_tax_rate_basis_points: 'Order tax override (basis points)',
  tax_total_minor: 'Tax total (minor units)',
  grand_total_minor: 'Order total (minor units)',
  version: 'Version',
  deleted_at: 'Deleted at',
  completed_at: 'Completed at',
  items: 'Line items',
  note_id: 'Note ID',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
  is_active: 'Active',
  sku: 'SKU',
  price: 'Unit price',
  tax_rate: 'Tax rate',
  stock_quantity: 'Stock quantity',
  stock_version: 'Stock version',
}

export const operationalAuditItemFields = Object.freeze({
  product_id: 'Product ID',
  product_sku: 'SKU',
  quantity: 'Quantity',
  unit_price_minor: 'Unit price (minor units)',
  subtotal_minor: 'Subtotal (minor units)',
  item_discount_minor: 'Item discount (minor units)',
  allocated_order_discount_minor: 'Order discount share (minor units)',
  base_tax_rate_basis_points: 'Catalog tax rate (basis points)',
  tax_rate_basis_points: 'Applied tax rate (basis points)',
  tax_minor: 'Tax (minor units)',
  line_total_minor: 'Line total (minor units)',
})

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

export function formatOperationalAuditAction(action) {
  return Object.hasOwn(operationalAuditActions, action) ? operationalAuditActions[action] : action
}

export function formatOperationalAuditTime(timestamp) {
  return dateTime.format(new Date(timestamp)) + ' UTC'
}

export function operationalAuditChanges(before, after) {
  return Object.entries(auditFields)
    .map(([key, label]) => ({ key, label, before: before?.[key], after: after[key] }))
    .filter(
      (field) =>
        field.before === '[redacted]' ||
        field.after === '[redacted]' ||
        JSON.stringify(field.before) !== JSON.stringify(field.after),
    )
}
