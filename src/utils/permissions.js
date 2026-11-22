const permissionLabels = new Map([
  ['orders.view.assigned', 'View assigned orders'],
  ['orders.status.update.assigned', 'Update assigned order status'],
  ['orders.notes.create.assigned', 'Add notes to assigned orders'],
  ['orders.view.any', 'View all orders'],
  ['orders.create', 'Create orders'],
  ['orders.update', 'Edit orders'],
  ['orders.assign', 'Assign orders'],
  ['orders.delete', 'Delete orders'],
  ['orders.status.update.any', 'Update any order status'],
  ['orders.notes.create.any', 'Add notes to any order'],
  ['customers.view', 'View customers'],
  ['customers.view.assigned-orders', 'View customers on assigned orders'],
  ['customers.manage', 'Manage customers'],
  ['products.view', 'View products'],
  ['products.manage', 'Manage products'],
  ['users.manage', 'Manage users'],
  ['roles.manage', 'Manage roles and permissions'],
  ['audit.view', 'View audit log'],
  ['dashboard.view', 'View dashboard'],
  ['reports.view', 'View reports'],
])

function permissionGroup(name) {
  const [area] = name.split('.')
  if (area === 'orders') return name.endsWith('.assigned') ? 'Assigned orders' : 'Order management'
  if (area === 'customers' || area === 'products') return 'Catalog'
  if (['users', 'roles', 'audit', 'dashboard', 'reports'].includes(area)) return 'Administration'
  return 'Other permissions'
}

export function getPermissionLabel(name) {
  return permissionLabels.get(name) ?? name
}

export function groupPermissions(names) {
  const groups = new Map(
    ['Assigned orders', 'Order management', 'Catalog', 'Administration', 'Other permissions'].map(
      (group) => [group, []],
    ),
  )
  for (const name of names) groups.get(permissionGroup(name)).push(name)
  return [...groups.entries()].filter(([, permissions]) => permissions.length)
}
