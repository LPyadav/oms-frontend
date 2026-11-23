import { expect, it, vi } from 'vitest'
import { loadAccessAuditLog, loadAccessAuditPage } from '../api/accessAudit'
import { loadAdminUser, loadAdminUserPage } from '../api/adminUsers'

const user = {
  id: 17,
  name: 'Alex Khan',
  email: 'alex@example.test',
  is_active: false,
  roles: ['Warehouse QA'],
}

const log = {
  id: 43,
  actor_id: 9,
  target_type: 'user',
  target_id: 17,
  action: 'user.permissions.replaced',
  before_values: { direct_permissions: ['orders.create'] },
  after_values: { direct_permissions: [] },
  created_at: '2026-11-22T10:00:00.000000Z',
}

function pageEnvelope(resource, entries, currentPage) {
  return {
    data: { [resource]: entries },
    meta: { current_page: currentPage, per_page: 25, total: 26, last_page: 2 },
  }
}

it('sends the exact role and the disabled status with the user search', async () => {
  const request = vi.fn().mockResolvedValue(pageEnvelope('users', [user], 2))
  const { signal } = new AbortController()

  await expect(
    loadAdminUserPage(
      request,
      { page: 2, search: 'Alex + Ops', status: 'disabled', role: 'Warehouse QA' },
      signal,
    ),
  ).resolves.toEqual({ users: [user], currentPage: 2, perPage: 25, total: 26, lastPage: 2 })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/admin/users?page=2&search=Alex+%2B+Ops&is_active=0&role=Warehouse+QA',
    { signal },
  )
})

it.each([
  ['all', '/api/admin/users?page=1'],
  ['active', '/api/admin/users?page=1&is_active=1'],
])('serializes the %s user status', async (status, url) => {
  const request = vi.fn().mockResolvedValue(pageEnvelope('users', [], 1))
  await loadAdminUserPage(request, { page: 1, search: '', status, role: '' })
  expect(request).toHaveBeenCalledExactlyOnceWith(url, { signal: undefined })
})

it('loads fresh user detail and rejects a mismatched user ID', async () => {
  const request = vi.fn().mockResolvedValue({ data: { user } })
  const { signal } = new AbortController()

  await expect(loadAdminUser(request, 17, signal)).resolves.toEqual(user)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/users/17', { signal })
  await expect(loadAdminUser(request, 99, signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('loads filtered audit pages and preserves cleared direct permission arrays', async () => {
  const request = vi.fn().mockResolvedValue(pageEnvelope('logs', [log], 2))
  const { signal } = new AbortController()
  await expect(
    loadAccessAuditPage(
      request,
      {
        page: 2,
        action: 'user.permissions.replaced',
        actorId: 9,
        targetType: 'user',
        targetId: 17,
      },
      signal,
    ),
  ).resolves.toMatchObject({ logs: [log], currentPage: 2 })
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/admin/access-audit-logs?page=2&action=user.permissions.replaced&actor_id=9&target_type=user&target_id=17',
    { signal },
  )
})

it('accepts a null before snapshot and rejects an array in place of an audit snapshot', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ data: { log: { ...log, before_values: null } } })
    .mockResolvedValueOnce({ data: { log: { ...log, after_values: [] } } })
  const { signal } = new AbortController()
  await expect(loadAccessAuditLog(request, log.id, signal)).resolves.toEqual({
    ...log,
    before_values: null,
  })
  expect(request).toHaveBeenNthCalledWith(1, '/api/admin/access-audit-logs/43', { signal })
  await expect(loadAccessAuditLog(request, log.id, signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
