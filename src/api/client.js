export class ApiError extends Error {
  constructor(message, { status = 0, code = null, fields = {}, retryAfter = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
  }
}

export async function apiRequest(
  path,
  { method = 'GET', body, signal, token, idempotencyKey } = {},
) {
  if (!path.startsWith('/api/')) {
    throw new TypeError('API requests must use a same-origin /api/ path.')
  }

  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const timeout = AbortSignal.timeout(10000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const options = {
    method,
    headers,
    credentials: 'omit',
    redirect: 'error',
    signal: requestSignal,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  let payload

  try {
    response = await fetch(path, options)
    payload = await response.json().catch((error) => {
      if (requestSignal.aborted) throw error
      return null
    })
  } catch (error) {
    if (signal?.aborted) throw error

    throw new ApiError('Could not reach the server. Please try again.', { code: 'NETWORK_ERROR' })
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || 'The request could not be completed.', {
      status: response.status,
      code: payload?.errors?.code,
      fields: payload?.errors?.fields ?? {},
      retryAfter: response.headers.get('Retry-After'),
    })
  }

  if (payload?.success !== true) {
    throw new ApiError('The server returned an unexpected response.', { code: 'INVALID_RESPONSE' })
  }

  return payload
}
