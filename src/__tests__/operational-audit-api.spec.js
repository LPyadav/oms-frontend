import { expect, it, vi } from 'vitest'
import { loadOperationalAuditLog, loadOperationalAuditPage } from '../api/operationalAudit'
import { operationalAuditChanges } from '../utils/operationalAudit'

const log = {
  id: 45,
  actor_id: 3,
  actor_name: 'Avery Lee',
  target_type: 'order',
  target_id: 15,
  action: 'order.status_changed',
  created_at: '2026-11-23T19:30:00.000000Z',
}

it('sends operational audit filters and reads paginated summaries', async () => {
  const request = vi.fn().mockResolvedValue({
    data: { logs: [log] },
    meta: { current_page: 2, per_page: 10, total: 11, last_page: 2 },
  })
  const { signal } = new AbortController()

  await expect(
    loadOperationalAuditPage(
      request,
      {
        page: 2,
        perPage: 10,
        actorId: 3,
        action: 'order.status_changed',
        targetType: 'order',
        targetId: 15,
        dateFrom: '2026-11-01',
        dateTo: '2026-11-23',
      },
      signal,
    ),
  ).resolves.toEqual({ logs: [log], currentPage: 2, perPage: 10, total: 11, lastPage: 2 })

  const [[path, options]] = request.mock.calls
  const url = new URL(path, 'http://localhost')
  expect(url.pathname).toBe('/api/admin/audit-logs')
  expect(Object.fromEntries(url.searchParams)).toEqual({
    page: '2',
    per_page: '10',
    actor_id: '3',
    action: 'order.status_changed',
    target_type: 'order',
    target_id: '15',
    date_from: '2026-11-01',
    date_to: '2026-11-23',
  })
  expect(options).toEqual({ signal })
})

it('preserves before and after values including safe nested line items', async () => {
  const detail = {
    ...log,
    actor_name: null,
    before_values: null,
    after_values: { items: [{ product_id: 4, quantity: 1 }], tax_total_minor: 0 },
  }
  const request = vi.fn().mockResolvedValue({ data: { log: detail } })

  await expect(loadOperationalAuditLog(request, 45)).resolves.toEqual(detail)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/admin/audit-logs/45', {
    signal: undefined,
  })
})

it.each([
  { id: 46, before_values: null, after_values: {} },
  { before_values: [], after_values: {} },
  { before_values: null, after_values: { items: [{ product_id: ['broken'] }] } },
])('rejects a mismatched record or malformed snapshots with %j', async (invalidFields) => {
  const request = vi.fn().mockResolvedValue({ data: { log: { ...log, ...invalidFields } } })

  await expect(loadOperationalAuditLog(request, 45)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

it('keeps redacted changes and zero values while omitting unknown and unchanged fields', () => {
  const changes = operationalAuditChanges(
    { name: 'Same', tax_total_minor: 100, email: '[redacted]' },
    { name: 'Same', tax_total_minor: 0, email: '[redacted]', password: 'unexpected' },
  )

  expect(changes).toEqual([
    { key: 'tax_total_minor', label: 'Tax total (minor units)', before: 100, after: 0 },
    { key: 'email', label: 'Email', before: '[redacted]', after: '[redacted]' },
  ])
})
