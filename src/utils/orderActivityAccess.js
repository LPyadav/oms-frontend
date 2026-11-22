export function canChangeOrderAssignee(order, auth) {
  return (
    Boolean(order && auth.canAssignOrders) &&
    order.status !== 'completed' &&
    order.status !== 'cancelled'
  )
}

export function canAddNoteToOrder(order, auth) {
  return Boolean(
    order &&
    (auth.canAddOrderNote ||
      (auth.canAddAssignedOrderNote && order.assignee && order.assignee.id === auth.user?.id)),
  )
}
