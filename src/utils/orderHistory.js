import { ORDER_STATUS, ORDER_WORKFLOW } from '../constants/orders'

const systemNames = { 'order.created': 'Order created', 'order.updated': 'Order updated' }

export function orderTimeline(order) {
  const timestamps = new Map()
  const reached = new Set([order.status])
  for (const event of order.status_history) {
    reached.add(event.previous_status)
    reached.add(event.new_status)
    timestamps.set(event.new_status, event.created_at)
  }
  if (!timestamps.has('completed') && order.completed_at) {
    timestamps.set('completed', order.completed_at)
  }

  const statuses = ORDER_WORKFLOW.filter((status) => status !== 'draft' || reached.has(status))
  if (order.status === 'cancelled') statuses.push('cancelled')
  return [
    { key: 'created', title: 'Created', at: order.created_at, reached: true },
    ...statuses.map((key) => {
      const at = timestamps.get(key) ?? null
      return { key, title: ORDER_STATUS[key], at, reached: at !== null || reached.has(key) }
    }),
  ]
}

function assigneeLabel(order, id) {
  if (id === null) return 'Unassigned'
  return order.assignee?.id === id ? order.assignee.name : `User #${id}`
}

export function orderActivity(order) {
  const events = [
    ...order.status_history.map((entry) => ({
      key: `status-${entry.id}`,
      type: 'Status',
      title: `${ORDER_STATUS[entry.previous_status]} → ${ORDER_STATUS[entry.new_status]}`,
      actor: entry.actor?.name ?? 'Unknown actor',
      at: entry.created_at,
      body: entry.remarks,
    })),
    ...order.notes.map((entry) => ({
      key: `note-${entry.id}`,
      type: 'Note',
      title: 'Note added',
      actor: entry.author?.name ?? 'Unknown author',
      at: entry.created_at,
      body: entry.body,
    })),
    ...order.assignment_history.map((entry) => ({
      key: `assignment-${entry.id}`,
      type: 'Assignment',
      title: `${assigneeLabel(order, entry.previous_assignee_id)} → ${assigneeLabel(order, entry.new_assignee_id)}`,
      actor: entry.actor_name ?? `User #${entry.actor_id}`,
      at: entry.created_at,
    })),
    ...order.system_activity.map((entry) => ({
      key: `system-${entry.id}`,
      type: 'System',
      title: systemNames[entry.action] ?? 'Order activity',
      actor: entry.actor_name ?? `User #${entry.actor_id}`,
      at: entry.created_at,
    })),
  ]
  return events.sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
}
