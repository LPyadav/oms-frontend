import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import ConnectionCheckView from '../views/ConnectionCheckView.vue'

const envelopedSuccess = { ok: true, json: async () => ({ success: true, data: { status: 'ok' } }) }
const legacySuccess = { ok: true, json: async () => ({ status: 'ok' }) }
let app

function mountView(fetchMock) {
  vi.stubGlobal('fetch', fetchMock)
  const page = document.createElement('div')
  app = createApp(ConnectionCheckView)
  app.mount(page)
  return page
}

afterEach(() => {
  app?.unmount()
  vi.unstubAllGlobals()
})

it.each([
  ['common API envelope', envelopedSuccess],
  ['legacy response', legacySuccess],
])('shows API connected for the %s', async (_, response) => {
  const page = mountView(vi.fn().mockResolvedValue(response))
  await vi.waitFor(() => expect(page.textContent).toContain('API connected'))
})

it('reconnects when the user retries a failed request', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(envelopedSuccess)
  const page = mountView(fetchMock)

  await vi.waitFor(() => expect(page.textContent).toContain('API unavailable'))
  page.querySelector('button').click()
  await vi.waitFor(() => expect(page.textContent).toContain('API connected'))
})
