import { describe, expect, it, vi } from 'vitest'
import { loadAccessAuditLog, loadAccessAuditPage } from '../api/accessAudit'
import { loadOperationalAuditLog, loadOperationalAuditPage } from '../api/operationalAudit'
import { formatAuditActor } from '../utils/auditActor'

const baseEntry = {
  id: 45,
  actor_id: 3,
  target_id: 15,
  created_at: '2026-11-23T19:30:00.000000Z',
  before_values: null,
  after_values: {},
}
const meta = { current_page: 1, per_page: 25, total: 1, last_page: 1 }

describe.each([
  {
    title: 'access',
    endpoint: '/api/admin/access-audit-logs',
    list: loadAccessAuditPage,
    detail: loadAccessAuditLog,
    entry: { ...baseEntry, target_type: 'user', action: 'user.enabled' },
    fallback: 'User #3',
  },
  {
    title: 'operational',
    endpoint: '/api/admin/audit-logs',
    list: loadOperationalAuditPage,
    detail: loadOperationalAuditLog,
    entry: { ...baseEntry, actor_name: 'Avery Lee', target_type: 'order', action: 'order.updated' },
    fallback: 'Avery Lee #3',
  },
])('$title audit actors', ({ endpoint, list, detail, entry, fallback }) => {
  it.each([
    {
      title: 'supplied',
      fields: { actor_email: '  avery@example.test  ' },
      email: 'avery@example.test',
    },
    { title: 'null', fields: { actor_email: null } },
    { title: 'missing', fields: {} },
    { title: 'blank', fields: { actor_email: '   ' } },
  ])(
    'handles a $title email on both endpoints while keeping the actor ID filter',
    async ({ fields, email }) => {
      const log = { ...entry, ...fields }
      const request = vi
        .fn()
        .mockResolvedValueOnce({ data: { logs: [log] }, meta })
        .mockResolvedValueOnce({ data: { log } })
      const { signal } = new AbortController()

      const page = await list(request, { page: 1, actorId: 3 }, signal)
      expect(page.logs).toEqual([log])
      expect(await detail(request, 45, signal)).toEqual(log)
      expect(formatAuditActor(page.logs[0], entry.actor_name)).toBe(email ?? fallback)
      expect(request).toHaveBeenNthCalledWith(1, endpoint + '?page=1&actor_id=3', { signal })
      expect(request).toHaveBeenNthCalledWith(2, endpoint + '/45', { signal })
    },
  )

  it('rejects a non-string email in both responses', async () => {
    const log = { ...entry, actor_email: 123 }
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { logs: [log] }, meta })
      .mockResolvedValueOnce({ data: { log } })

    await expect(list(request, { page: 1 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(detail(request, 45)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})

it('uses the user ID label when the name and email are both null', () => {
  expect(formatAuditActor({ actor_id: 3, actor_email: null }, null)).toBe('User #3')
})
