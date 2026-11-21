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
2. Open [the health endpoint through Vite](http://127.0.0.1:5173/api/health). It should return HTTP `200` with `data.status` set to `"ok"`. The connection screen also accepts the top-level `status` used by the Foundation backend.
3. If the screen shows **API unavailable**, check that Laravel is listening on port `8000`, then select **Try again**.

The Vue view uses the relative URL `/api/health`. Vite proxies `/api` requests from `127.0.0.1:5173` to Laravel at `127.0.0.1:8000`. For a deployed build, configure the hosting service to forward `/api` to Laravel on the same origin as the Vue app.

## Run tests

Run these commands from the frontend repository root after `npm ci`. The Epic 01 tests mock the API responses.

**Run the full unit suite once**

```sh
npm run test:unit -- --run
```

The full suite includes any Epic 02 test files in the working tree. To reproduce the scoped Epic 01 verification, run the three suites together.

```sh
npm run test:unit -- --run --pool=threads --maxWorkers=1 src/__tests__/auth.spec.js src/__tests__/auth-routes.spec.js src/__tests__/App.spec.js
```

**Run one suite**

| Suite        | Command                                                        |
| ------------ | -------------------------------------------------------------- |
| Auth session | `npm run test:unit -- --run src/__tests__/auth.spec.js`        |
| Auth routing | `npm run test:unit -- --run src/__tests__/auth-routes.spec.js` |
| API health   | `npm run test:unit -- --run src/__tests__/App.spec.js`         |

## Lint, format, and build

```sh
npm run lint
npm run format:check
npm run build
```

Use `npm run lint:fix` to apply supported lint fixes. The production build writes assets to `dist/`.

## Epic 01 — Authentication

Epic 01 adds the OMS sign-in flow, bearer-token session management, and a protected workspace. It also establishes the frontend formatting conventions and Vuetify theme and keeps the public connection check compatible with both Laravel health response formats.

- **Branch** `feat/authentication`
- **Verified commit** `b1a2917`
- **Verification date** 22 November 2026

### Routes

| Route        | Access              | Behavior                                                                                |
| ------------ | ------------------- | --------------------------------------------------------------------------------------- |
| `/`          | Public              | Checks API health and offers a retry when the API is unavailable.                       |
| `/login`     | Guests              | Shows the Vuetify sign-in form and sends users with a verified session to `/workspace`. |
| `/workspace` | Authenticated users | Shows the verified account and provides sign-out. Guests are redirected to `/login`.    |

### Session and API behavior

| Request            | Frontend behavior                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/login`  | Submits email and password. Stores the returned token and expiry in `sessionStorage` and verifies the account through `/api/me`.                                                          |
| `GET /api/me`      | Sends the bearer token and loads the current account. A refresh restores access after profile verification. The sign-in screen offers a retry if verification is temporarily unavailable. |
| `POST /api/logout` | Sends the bearer token for revocation. Successful logout clears the local session and redirects to sign-in. A transient logout failure leaves the session available for retry.            |
| `GET /api/health`  | Accepts `{"success":true,"data":{"status":"ok"}}` and legacy `{"status":"ok"}`. A successful HTTP response with status `"ok"` shows **API connected**.                                    |

The Pinia store clears an expired session and clears the current session when an authenticated API request returns `401`. The router checks access before loading protected views and rechecks local expiry after the lazy workspace component loads. This second check handles expiry during navigation, including when the browser delays the expiry timer. The app redirects to `/login` when a session ends while the workspace is open.

### Project structure

| Area                 | Files                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend tooling     | [Prettier configuration](.prettierrc.json), [format exclusions](.prettierignore), [editor recommendations](.vscode/extensions.json), [npm scripts](package.json) |
| UI foundation        | [Vuetify and OMS theme](src/plugins/vuetify.js), [app entry point](src/main.js), [app shell](src/App.vue)                                                        |
| Bearer session       | [API client](src/api/client.js), [auth status constants](src/constants/auth.js), [Pinia auth store](src/stores/auth.js)                                          |
| Sign-in              | [Auth layout](src/layouts/AuthLayout.vue), [sign-in form composable](src/composables/useSignInForm.js), [login view](src/views/auth/LoginView.vue)               |
| Protected navigation | [Router](src/router/index.js), [workspace view](src/views/WorkspaceView.vue)                                                                                     |
| API health           | [Connection check view](src/views/ConnectionCheckView.vue), [health documentation](#verify-the-api-connection)                                                   |
| Development server   | [Vite configuration](vite.config.js)                                                                                                                             |
| Test environment     | [Vitest configuration](vitest.config.js)                                                                                                                         |

### Local commits

| Commit    | Message                                            |
| --------- | -------------------------------------------------- |
| `dd13c26` | `chore(tooling): standardize frontend formatting`  |
| `14c56aa` | `style(frontend): normalize scaffold formatting`   |
| `5206e53` | `chore(ui): add Vuetify and the OMS theme`         |
| `1a7455b` | `feat(auth): add sign-in and protected workspace`  |
| `b1a2917` | `fix(health): handle wrapped API health responses` |

### Final verification

The checks ran against a temporary copy of committed `HEAD` with the existing installed dependencies. Vitest used mocked API responses. All **20 tests across 3 files** passed.

| Check                                                   | Result   | Coverage                                                                                                                                     |
| ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Auth session tests](src/__tests__/auth.spec.js)        | 9 passed | Sign-in, profile verification and restoration, role and permission checks, retry, validation and rate limits, sign-out, `401`, and expiry.   |
| [Auth routing tests](src/__tests__/auth-routes.spec.js) | 8 passed | Guest redirects, session restoration, retry, rejected sessions, public route access, and workspace expiry with the timer running or delayed. |
| [Health tests](src/__tests__/App.spec.js)               | 3 passed | Wrapped response, legacy response, and recovery after retry.                                                                                 |
| `npm run lint`                                          | Passed   | Oxlint and ESLint.                                                                                                                           |
| `npm run format:check`                                  | Passed   | Prettier.                                                                                                                                    |
| `npm run build`                                         | Passed   | Vite production build.                                                                                                                       |
| `git diff --check 7384ced..HEAD`                        | Passed   | Whitespace check across the five Epic 01 commits.                                                                                            |

### Git status at verification

At the time of verification, tracked files were clean and the staging area was empty. The four untracked files below are Epic 02 work. Their contents were verified unchanged. The Epic 01 commits are local.

```text
## feat/authentication
?? src/__tests__/AdminUsersView.spec.js
?? src/__tests__/admin-routes.spec.js
?? src/components/admin/UserAccountDialog.vue
?? src/views/admin/AdminUsersView.vue
```
