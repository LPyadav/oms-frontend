import { ApiError } from './client'
import { readPaginatedResource } from './pagination'

const auditPath = '/api/admin/access-audit-logs'
const auditTargets = new Set(['user', 'role'])
const isId = (value) => Number.isSafeInteger(value) && value > 0
const isSnapshot = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function isAuditLog(log) {
  return (
    isId(log?.id) &&
    isId(log.actor_id) &&
    (log.actor_email == null || typeof log.actor_email === 'string') &&
    auditTargets.has(log.target_type) &&
    isId(log.target_id) &&
    typeof log.action === 'string' &&
    log.action.length > 0 &&
    typeof log.created_at === 'string' &&
    Number.isFinite(Date.parse(log.created_at)) &&
    (log.before_values === null || isSnapshot(log.before_values)) &&
    isSnapshot(log.after_values)
  )
}

export async function loadAccessAuditPage(
  request,
  { page, action, actorId, targetType, targetId },
  signal,
) {
  const params = new URLSearchParams({ page: String(page) })
  if (action) params.set('action', action)
  if (actorId) params.set('actor_id', String(actorId))
  if (targetType) params.set('target_type', targetType)
  if (targetId) params.set('target_id', String(targetId))

  const response = await request(`${auditPath}?${params}`, { signal })
  return readPaginatedResource(response, {
    resource: 'logs',
    isEntry: isAuditLog,
    page,
    invalidMessage: 'The server returned an invalid access audit page.',
  })
}

export async function loadAccessAuditLog(request, id, signal) {
  if (!isId(id)) throw new ApiError('The audit record ID is invalid.', { code: 'INVALID_RESPONSE' })

  const { data } = await request(`${auditPath}/${id}`, { signal })
  if (!isAuditLog(data?.log) || data.log.id !== id) {
    throw new ApiError('The server returned an invalid access audit record.', {
      code: 'INVALID_RESPONSE',
    })
  }
  return data.log
}
