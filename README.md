# OMS Frontend

Vue 3 single-page application for the Order Management System. The separate
[Laravel API](https://github.com/LPyadav/oms-backend) provides authentication,
authorization, order pricing, inventory, notifications, and reports.

## Setup

- Node.js 22.18+ on Node 22 or Node.js 24.12+, with its bundled npm.
- PHP, Composer 2.8 or later, and MySQL for the Laravel app. Follow the
  [backend local setup](https://github.com/LPyadav/oms-backend#local-setup)
  to configure `.env` and generate the application key.
- Follow the [assessment demo setup](https://github.com/LPyadav/oms-backend#assessment-demo-dataset)
  for migrations, review accounts, sample orders, and the queue worker and
  scheduler. Save the generated demo passwords and start Laravel on
  `http://127.0.0.1:8000`.

From the frontend checkout:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies relative `/api` requests to
Laravel. Open `/dev/health` and verify **API connected**. The diagnostic
accepts both the wrapped and original Laravel health responses. Deploy
`dist/` with SPA fallback and forward `/api` to Laravel on the same origin.

## Workflows

Paginated listings show up to 10 rows per page.

Apply the filters, then select **Export CSV** on the relevant page.

- **Orders** uses the applied search, filters and sort. It requires global order access.
- **Order/Fulfillment report** uses the selected order date range, status, customer and assignee.
- **Sales/Tax report** uses the completion date range, customer and product. A product
  filter includes the full totals of matching completed orders.

Both report downloads require report access. Orders and both report exports
include matching rows across all pages. The default limit is 50,000 orders per
download. The backend can lower the limit through `ORDERS_EXPORT_MAX_ROWS`
for Orders and `REPORTS_EXPORT_MAX_ROWS` for both reports. Apply narrower
filters if the result exceeds the configured limit.

| Area                   | What to verify                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication         | Sign in, restore on refresh, and return to an authorized deep link after expiry. Open the profile menu to change your password or sign out. Changing a password revokes all tokens and requires sign-in again.                                                      |
| Users and roles        | As Admin, filter users, open Manage, enable/disable a user, assign roles, and grant or clear direct permissions. Role grants and inherited permissions remain separately visible.                                                                                   |
| Audit                  | As Admin, expand Audit in the sidebar. Review role and user changes in Access audit and order, customer, and product changes in Operational audit. Verify a record's actor, time, and before/after values.                                                          |
| Customers and products | Search and manage catalog entries. Customer detail shows scoped order counts, currency-specific values, and recent orders. Review fresh counts after a stock conflict.                                                                                              |
| Orders                 | As Manager, create an order with multiple products, discounts and tax, assign it, confirm it, and inspect the saved totals and stock change. Sign in as its Staff assignee and progress through permitted stages. Verify an unrelated Staff account cannot open it. |
| Notifications          | Verify an assignment, confirmation, or cancellation in the recipient inbox. Check the unread badge, mark one, and mark all.                                                                                                                                         |
| Dashboard and reports  | As Admin or Manager with permission, verify KPIs and revenue. Under Reports, use Order/Fulfillment report for order dates and Sales/Tax report for completion dates in the reporting timezone.                                                                      |

To verify password recovery locally, run
`php artisan queue:work --queue=notifications,default` from the backend
directory. On the sign-in page, select **Forgot password?** and submit an
active demo account email.
With the default `MAIL_MAILER=log`, open the reset link from the backend’s
`storage/logs/laravel.log` after the worker processes the request. The link
opens `/reset-password` on the Vue app. Set a new password, sign in again,
and verify that earlier sessions for the account have been revoked.

The [backend password recovery guide](https://github.com/LPyadav/oms-backend/blob/main/docs/password-recovery.md)
covers SMTP inbox delivery and troubleshooting.

## Testing and build

```sh
npm run test:unit -- --run
npm run lint
npm run format:check
npm run build
```

Vitest covers API contracts and UI workflows with controlled responses.
For integration verification, run both apps against the same seeded backend
revision and replay the three-role workflow above at desktop and mobile sizes.
Record both commit IDs, the database and reporting timezone, and the observed
results. Verify loading, empty, retry, and permission-denied paths.

## Architecture and trade-offs

- **Vue Router and Vuetify** provide protected views, responsive navigation,
  dialogs, inputs, and tables. The shared directory components handle common
  paging and state patterns.
- **Pinia** owns the authenticated identity, token lifecycle, and effective
  grants. Feature composables hold local state and cancel stale reads. Laravel
  policies and query scopes enforce permissions even when controls are hidden.
- **API client** handles the response envelope, cancellation, and a default
  10-second timeout. A caller can supply a positive-integer `timeoutMs`.
  See the backend [OpenAPI contract](https://github.com/LPyadav/oms-backend/blob/main/docs/openapi.yaml).
- **Session storage** keeps a bearer token across refreshes in the same tab.
  Same-origin JavaScript can read it, so an XSS defect could expose it until
  expiry or revocation. The app verifies `/api/me` when restoring a session,
  warns five minutes before expiry, and drops the session on a protected
  request's `401`.
- **Financial data** uses server-stored minor units with currency labels.
  Report totals are exact strings and remain separated by currency. The first
  report response resolves blank dates and pagination preserves that range.
  Each page reflects its own server snapshot.

## AI assistance

Codex helped inspect the assessment, propose reviewable patches, implement
Vue components and API integrations, and generate targeted tests and release
documentation. The project owner reviewed and approved the earlier changes
in separate patches and controlled staging, commits, pushes, and merges.
Review the API envelopes, role checks, price snapshots, and conflict paths
alongside the related tests before sign-off.
