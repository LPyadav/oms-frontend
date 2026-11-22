const actionLabels = new Map([
  ['user.enabled', 'Account enabled'],
  ['user.disabled', 'Account disabled'],
  ['user.roles.replaced', 'User roles updated'],
  ['user.permissions.replaced', 'Direct permissions updated'],
  ['role.created', 'Role created'],
  ['role.renamed', 'Role renamed'],
  ['role.permissions.replaced', 'Role permissions updated'],
])

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function formatAccessAuditAction(action) {
  return actionLabels.get(action) ?? action
}

export function formatAccessAuditTime(timestamp) {
  return dateTime.format(new Date(timestamp))
}
