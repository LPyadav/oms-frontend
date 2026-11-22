export function getSignedInRouteName(canManageUsers) {
  return canManageUsers ? 'admin-users' : 'workspace'
}
