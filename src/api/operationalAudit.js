import { ApiError } from './client'
import { readPaginatedResource } from './pagination'

const auditPath = '/api/admin/audit-logs'
const targets = new Set(['order', 'customer', 'product'])
const isId = (value) => Number.isSafeInteger(value) && value > 0
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isScalar = (value) =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  Number.isSafeInteger(value)

function isLog(log) {
  return (
    isId(log?.id) &&
    isId(log.actor_id) &&
    (log.actor_email == null || typeof log.actor_email === 'string') &&
    (log.actor_name === null || typeof log.actor_name === 'string') &&
    targets.has(log.target_type) &&
    isId(log.target_id) &&
    typeof log.action === 'string' &&
    log.action.length > 0 &&
    typeof log.created_at === 'string' &&
    Number.isFinite(Date.parse(log.created_at))
  )
}

function isSnapshot(snapshot) {
  return (
    isObject(snapshot) &&
    Object.entries(snapshot).every(([key, value]) =>
      key === 'items'
        ? Array.isArray(value) &&
          value.every((item) => isObject(item) && Object.values(item).every(isScalar))
        : isScalar(value),
    )
  )
}

export async function loadOperationalAuditPage(request, query, signal) {
  const params = new URLSearchParams({ page: String(query.page) })
  const filters = {
    action: query.action,
    actor_id: query.actorId,
    target_type: query.targetType,
    target_id: query.targetId,
    date_from: query.dateFrom,
    date_to: query.dateTo,
    per_page: query.perPage,
  }

  for (const [field, value] of Object.entries(filters)) {
    if (value) params.set(field, String(value))
  }

  const response = await request(auditPath + '?' + params, { signal })
  return readPaginatedResource(response, {
    resource: 'logs',
    isEntry: isLog,
    page: query.page,
    invalidMessage: 'The server returned an invalid operational audit page.',
  })
}

export async function loadOperationalAuditLog(request, id, signal) {
  if (!isId(id)) throw new ApiError('The audit record ID is invalid.', { code: 'INVALID_RESPONSE' })

  const response = await request(auditPath + '/' + id, { signal })
  const log = response?.data?.log
  if (
    !isLog(log) ||
    log.id !== id ||
    (log.before_values !== null && !isSnapshot(log.before_values)) ||
    !isSnapshot(log.after_values)
  ) {
    throw new ApiError('The server returned an invalid operational audit record.', {
      code: 'INVALID_RESPONSE',
    })
  }

  return log
}
