import { ORDER_WORKFLOW } from '../constants/orders'

const assignedTransitions = Object.freeze(['processing', 'ready'])

export function availableOrderStatuses(order, auth) {
  if (!order) return []

  const index = ORDER_WORKFLOW.indexOf(order.status)
  const next = index >= 0 ? ORDER_WORKFLOW[index + 1] : undefined
  if (!next) return []
  if (auth.canChangeAnyOrderStatus) return [next, 'cancelled']
  if (
    auth.canChangeAssignedOrderStatus &&
    order.assignee &&
    order.assignee.id === auth.user?.id &&
    assignedTransitions.includes(next)
  ) {
    return [next]
  }

  return []
}
