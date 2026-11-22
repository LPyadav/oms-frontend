import { ApiError } from './client'

const rolesPath = '/api/admin/roles'

export async function loadRoleNames(request, signal) {
  const names = new Set()
  let lastPage = 1

  for (let page = 1; page <= lastPage; page += 1) {
    const { data, meta } = await request(`${rolesPath}?page=${page}`, { signal })
    if (signal.aborted) return []

    if (
      !Array.isArray(data?.roles) ||
      !data.roles.every((role) => typeof role?.name === 'string' && role.name.trim()) ||
      meta?.current_page !== page ||
      !Number.isInteger(meta.last_page) ||
      meta.last_page < page
    ) {
      throw new ApiError('The server returned an invalid role list.', {
        code: 'INVALID_RESPONSE',
      })
    }

    for (const { name } of data.roles) names.add(name)
    lastPage = meta.last_page
  }

  return [...names]
}
