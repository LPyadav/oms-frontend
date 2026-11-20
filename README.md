# OMS Frontend

Vue single-page application for the Order Management System. The Laravel API lives in the separate `oms-backend` repository. The Foundation module adds a home screen that checks the API connection and lets the user retry a failed request.

## Prerequisites

- Node.js 22.18 or later on the Node 22 release line, or Node.js 24.12 or later.
- The npm version bundled with your Node.js installation.
- `oms-backend` running on `http://127.0.0.1:8000`. Follow its README to configure MySQL and start Laravel.

## Run locally

From the `oms-frontend` directory, install the locked dependencies and start Vite.

```sh
npm ci
npm run dev
```

## Verify the API connection

1. Open [the OMS frontend](http://127.0.0.1:5173/). The connection screen shows **API connected** once Laravel responds.
2. Open [the health endpoint through Vite](http://127.0.0.1:5173/api/health). It should return HTTP `200` with `{"status":"ok"}`.
3. If the screen shows **API unavailable**, check that Laravel is listening on port `8000`, then select **Try again**.

The Vue view uses the relative URL `/api/health`. Vite proxies `/api` requests from `127.0.0.1:5173` to Laravel at `127.0.0.1:8000`. For a deployed build, configure the hosting service to forward `/api` to Laravel on the same origin as the Vue app.

## Project structure

| File | Responsibility |
| --- | --- |
| `src/main.js` | Starts Vue and registers Pinia and Vue Router. |
| `src/router/index.js` | Maps the home route to the connection screen. |
| `src/views/ConnectionCheckView.vue` | Shows connection status and handles retry. |
| `vite.config.js` | Configures the local dev server and API proxy. |
| `vitest.config.js` | Configures the Vue test environment. |

## Development checks

```sh
npm run test:unit -- --run
npm run lint
npm run build
```

The test command runs Vitest once. The lint command runs Oxlint and ESLint with autofix. The build command writes production assets to `dist/`.
