export function loginLocation(route) {
  return {
    name: 'login',
    ...(route?.meta.requiresAuth && { query: { redirect: route.fullPath } }),
    replace: true,
  }
}

function isInternalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return false

  try {
    const path = decodeURIComponent(value.split(/[?#]/, 1)[0])
    return (
      !path.startsWith('//') &&
      [...path].every(
        (character) => character > '\u001f' && character !== '\u007f' && character !== '\\',
      )
    )
  } catch {
    return false
  }
}

export function signedInLocation(router, redirect) {
  if (isInternalPath(redirect)) {
    const target = router.resolve(redirect)
    const record = target.matched.at(-1)
    if (target.name && target.meta.requiresAuth && !target.meta.guestOnly && !record?.redirect) {
      return {
        name: target.name,
        params: target.params,
        query: target.query,
        hash: target.hash,
      }
    }
  }

  return { name: 'workspace' }
}
