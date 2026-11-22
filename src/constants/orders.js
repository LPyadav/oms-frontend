export const ORDER_STATUS = Object.freeze({
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
})

export const ORDER_PRIORITY = Object.freeze({
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
})

export const ORDER_SORT = Object.freeze({
  order_date: 'Order date',
  total: 'Total',
  status: 'Status',
  priority: 'Priority',
  customer: 'Customer',
})

export const FIRST_ORDER_PAGE = Object.freeze({
  page: 1,
  search: '',
  status: '',
  priority: '',
  dateFrom: '',
  dateTo: '',
  sort: 'order_date',
  direction: 'desc',
})
