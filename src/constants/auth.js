export const AUTH_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  ANONYMOUS: 'anonymous',
  UNAVAILABLE: 'unavailable',
})

export const AUTH_ROLE = Object.freeze({
  ADMIN: 'admin',
})

export const AUTH_PERMISSION = Object.freeze({
  MANAGE_USERS: 'users.manage',
  MANAGE_ROLES: 'roles.manage',
})
