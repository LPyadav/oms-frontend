import { afterEach, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import ConnectionCheckView from '../views/ConnectionCheckView.vue'

const success = { ok: true, json: async () => ({ status: 'ok' }) }
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

it('shows API connected on success', async () => {
  const page = mountView(vi.fn().mockResolvedValue(success))
  await vi.waitFor(() => expect(page.textContent).toContain('API connected'))
})

it('reconnects when the user retries a failed request', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce(success)
  const page = mountView(fetchMock)

  await vi.waitFor(() => expect(page.textContent).toContain('API unavailable'))
  page.querySelector('button').click()
  await vi.waitFor(() => expect(page.textContent).toContain('API connected'))
})