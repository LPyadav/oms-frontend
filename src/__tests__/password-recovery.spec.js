import { createPinia, disposePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { createMemoryHistory, RouterView } from 'vue-router'
import { createAppRouter } from '../router'
import { useAuthStore } from '../stores/auth'

vi.mock('vuetify/components/VAlert', async () => {
  const { h } = await import('vue')
  return {
    VAlert: {
      setup:
        (_props, { slots }) =>
        () =>
          h('div', slots.default?.()),
    },
  }
})

vi.mock('vuetify/components/VBtn', async () => {
  const { h } = await import('vue')
  const { RouterLink } = await import('vue-router')
  return {
    VBtn: {
      props: ['to'],
      setup:
        (props, { slots }) =>
        () =>
          props.to ? h(RouterLink, { to: props.to }, slots) : h('button', slots.default?.()),
    },
  }
})

vi.mock('vuetify/components/VSheet', async () => {
  const { h } = await import('vue')
  return {
    VSheet: {
      props: ['tag'],
      setup:
        (props, { slots }) =>
        () =>
          h(props.tag || 'div', slots.default?.()),
    },
  }
})

vi.mock('vuetify/components/VTextField', async () => {
  const { h } = await import('vue')
  return {
    VTextField: {
      props: ['modelValue', 'errorMessages'],
      emits: ['update:modelValue'],
      setup:
        (props, { emit }) =>
        () =>
          h('input', {
            value: props.modelValue,
            'data-error': props.errorMessages?.[0],
            onInput: (event) => emit('update:modelValue', event.target.value),
          }),
    },
  }
})

const resetLink = '/reset-password#token=sample-link-token&email=buyer%2Borders%40example.test'
const email = 'buyer+orders@example.test'
const password = 'New password for testing'
let app
let pinia
let router
let auth
let site
let fetchMock

beforeEach(() => {
  sessionStorage.clear()
  pinia = createPinia()
  auth = useAuthStore(pinia)
  router = createAppRouter(createMemoryHistory())
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  app?.unmount()
  app = undefined
  site?.remove()
  disposePinia(pinia)
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

async function visit(path) {
  site = document.createElement('div')
  document.body.appendChild(site)
  app = createApp({ render: () => h(RouterView) })
  app.use(pinia).use(router)
  await router.push(path)
  await router.isReady()
  app.mount(site)
}

function fill(name, value) {
  const input = site.querySelector('input[name="' + name + '"]')
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submit() {
  site.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function success() {
  return Response.json({ success: true, data: null })
}

it('links from sign-in to public recovery and posts only the trimmed email', async () => {
  await visit('/login')
  const link = site.querySelector('a[href="/forgot-password"]')
  expect(link.textContent).toContain('Forgot password')
  await router.push(link.getAttribute('href'))
  await nextTick()
  expect(site.textContent).toContain('Send reset link')

  fetchMock.mockResolvedValueOnce(success())
  fill('email', ' ' + email + ' ')
  submit()

  await vi.waitFor(() => expect(site.textContent).toContain('a password reset link will be sent'))
  const [url, request] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/forgot-password')
  expect(JSON.parse(request.body)).toEqual({ email })
  expect(request.headers.Authorization).toBeUndefined()
})

it('preserves a plus-address from an emailed fragment and replaces the reset link after success', async () => {
  await visit(resetLink)
  expect(site.querySelector('input[name="email"]').value).toBe(email)
  fetchMock.mockResolvedValueOnce(success())
  fill('password', password)
  fill('password_confirmation', password)
  submit()

  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/login'))
  expect(auth.passwordWasChanged).toBe(true)
  const [url, request] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/reset-password')
  expect(JSON.parse(request.body)).toEqual({
    email,
    token: 'sample-link-token',
    password,
    password_confirmation: password,
  })
  expect(request.headers.Authorization).toBeUndefined()
  expect(sessionStorage.getItem('oms.session')).toBeNull()
})

it('offers a fresh link when the token is missing or rejected by the API', async () => {
  await visit('/reset-password')
  expect(site.querySelector('form')).toBeNull()
  expect(site.querySelector('a[href="/forgot-password"]').textContent).toContain(
    'Request a new link',
  )
  expect(fetchMock).not.toHaveBeenCalled()

  await router.push(resetLink)
  await vi.waitFor(() => expect(site.querySelector('input[name="password"]')).toBeTruthy())
  fetchMock.mockResolvedValueOnce(
    Response.json(
      { success: false, errors: { fields: { token: ['Invalid token'] } } },
      { status: 422 },
    ),
  )
  fill('password', password)
  fill('password_confirmation', password)
  submit()

  await vi.waitFor(() => expect(site.querySelector('form')).toBeNull())
  expect(site.textContent).toContain('This password reset link is invalid or expired.')
})

it('requires matching confirmation before sending the reset request', async () => {
  await visit(resetLink)
  fill('password', password)
  fill('password_confirmation', 'Different password')
  submit()

  expect(fetchMock).not.toHaveBeenCalled()
  await vi.waitFor(() =>
    expect(site.querySelector('input[name="password_confirmation"]').dataset.error).toContain(
      'The passwords do not match.',
    ),
  )
})
