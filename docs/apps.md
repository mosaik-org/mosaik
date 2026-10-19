# Building apps

An app is a manifest, an API contract, a backend and pages. Mosaik handles sign-in, permissions, roles,
navigation, search, notifications and the UI frame; the app brings its own data and screens.

Most apps are *mounted* in the Portal: the shell shows them with its navigation and look. An app can also
be *standalone*, on its own address with its own page, using Core alone ([Standalone apps](#standalone-apps)).
The backend code is the same.

- [Built-in and installed apps](#built-in-and-installed-apps)
- [The SDK](#the-sdk)
- [The manifest](#the-manifest)
- [Permissions, roles and owners](#permissions-roles-and-owners)
- [The backend](#the-backend)
- [Pages](#pages)
- [Notifications and messages](#notifications-and-messages)
- [Platform events](#platform-events)
- [Connectors](#connectors)
- [Standalone apps](#standalone-apps)
- [Shipping an app](#shipping-an-app)

## Built-in and installed apps

Most apps are **installed**: a team builds one in its own repository and admins install it at runtime.
**Built-in** apps are part of the platform itself (Administration, Platform status). Both look and behave
the same to users; they differ in where they live and how they ship:

| | Built-in | Installed |
|---|---|---|
| Lives in | this repository, `apps/<id>` | its team's repository |
| Ships with | the platform image | its own release: a Docker image the Portal runs, or hosted elsewhere |
| Pages | compiled into the shell (`web/routes/`) | its own browser bundle, loaded the first time someone opens it |
| Talks to the platform | the platform API, with a key derived from `INTERNAL_KEY` | the platform API, with its own key |
| Created with | `bun create:app <id> --builtin` | `bun create:app <id> --dir ../<id>` |

```sh
bun create:app inventory --builtin --db --icon package   # apps/inventory, picked up by `bun dev`
bun create:app crm --dir ../crm --db                     # its own repository, with the SDK in vendor/mosaik/
```

An installed app's README covers developing it against a running platform and shipping its image. A
built-in app needs the printed snippet in `infra/compose.yml` to deploy.

**Examples.** The apps in `examples/` are written exactly like a team's, so they are the place to look for
working code. `examples/sales` and `examples/issues` are mounted in the Portal: pages with typed URL state,
a server-side table, charts, roles, notifications, a command palette search, a database with migrations,
and a connector to an external system (Jira). `examples/notes` is standalone: its own page, signing people
in through Core. They differ from a team's repository in two ways only: they link the SDK from this
repository instead of installing its tarball (`bun examples:verify` builds them against the tarball too),
and they have no Dockerfile. `bun dev` runs them as apps hosted
elsewhere (Core knows them from [`CONFIGURED_APPS`](operations.md#deployment)); they are never deployed.

A typical workflow:

1. Declare permissions and roles in `manifest.ts`.
2. Define endpoints in `api/` and annotate the ones that need a specific permission.
3. Implement handlers in `server/`, using `Audit` for actions that change data and `Notify` / `Messages`
   to tell people about them.
4. Build pages with `makeApiClient(Api)` + TanStack Query, `@mosaik/sdk/ui`, `/table` and `/charts`.

## The SDK

Apps depend on one package, `@mosaik/sdk`, versioned like the platform. Its entry points follow where
code runs and which layer of Mosaik it needs:

| Import | Where | What |
|---|---|---|
| `@mosaik/sdk` | everywhere (`manifest.ts`, `api/`) | `defineApp`, permissions and roles, `Principal`, errors, `AccessControl`, `RequiredPermission`, `Fresh`, platform event types |
| `@mosaik/sdk/server` | `server/` | `runApp`, `Audit`, `Notify`, `Messages`, `Events`, `Live`, `Database` and migrations |
| `@mosaik/sdk/connectors`, `/connectors/jira` | `server/` | clients for external systems; `/connectors/jira/model` is isomorphic |
| `@mosaik/sdk/client` | any page | `makeApiClient`, error helpers, formatters, the session API; no framework |
| `@mosaik/sdk/solid` | Solid pages | `usePrincipal`, `useCan`, `<Can>`, `createEventStream`, `createQueryClient`, `createDebounced` |
| `@mosaik/sdk/portal` | pages mounted in the shell | `defineWebApp`, `AppLayout`, `NavTabs`, `useSearchParams`, `useTableSearch`, `useCommands`, `defineSearchProvider` |
| `@mosaik/sdk/ui`, `/table`, `/charts`, `/css` | pages | the design system, `QueryBoundary`, `DataTable`, charts, the app's styling runtime |
| `@mosaik/sdk/build/*` | `vite.config.ts`, `panda.config.ts`, `scripts/` | `mosaikApp`, `appPandaConfig`, `runAppDev`, `writeAppManifest` |

- **Core or Portal.** An app that imports nothing from `@mosaik/sdk/portal` runs without the Portal
  (standalone); the rest of the SDK is Core, apart from the design system it may use either way.
- **Sides.** Server code never imports a page's entry points and pages never import `server`,
  `connectors` or `build`; `bun lint` checks it for the examples.
- **Public API.** What the entry points export is the SDK; the packages behind them are internal and change
  without notice.

## The manifest

`manifest.ts` is isomorphic: the backend, the browser and the platform all read it. Everything but
`portal` is for Core; `portal` says how the Portal lists and runs the app, and a standalone app leaves
it out.

```ts
export const sales = defineApp({
  id: "sales",                 // URL segment (/sales), API prefix (/api/sales), permission namespace
  name: "Sales",
  description: "Revenue, orders and refunds.",
  access: "view",              // needed to open the app; the default for every endpoint
  permissions: {
    view: { description: "View revenue and orders", defaultRoles: ["authenticated"] },
    "orders.edit": { description: "Change the status of orders" },
    "orders.refund": { description: "Refund orders", dangerous: true },
  },
  roles: {
    "order-manager": { name: "Order manager", description: "Changes orders", grants: ["orders.edit"] },
    refunds: { name: "Refunds", grants: ["orders.*"] },
  },
  notifications: {
    "order.refunded": { description: "An order was refunded", defaultChannels: ["inApp"] },
  },
  events: ["user.deleted"],    // platform events the backend handles
  database: true,              // a Postgres database of its own
  portal: {
    icon: "chart-line",
    category: "Sales",         // where All apps lists it (owners and admins can change it)
    config: {                  // settings admins enter when the Portal runs the app's image
      PAYMENTS_URL: { description: "Payments API base URL" },
    },
  },
})
sales.perm("orders.refund")    // "sales:orders.refund", type-checked
```

## Permissions, roles and owners

- **Keys.** Permission keys are `<app>:<name>`. Roles hold grants, which may be wildcards: `*`, `sales:*`,
  `sales:orders.*`.
- **Built-in roles.** `anonymous` applies to everyone, so a public app grants it its access permission;
  `authenticated` applies to every logged-in user; `superadmin` holds `*`.
- **App roles** (`sales:refunds`) are declared in the manifest, so admins don't build a role per app.
  - Every app role includes the access permission. Grants name the app's own permissions, or wildcards
    over them, expanded to concrete permissions whenever the app registers: a role gains the permissions
    a new version adds.
  - Without `roles`, the app gets a `member` role that only opens it.
  - Every app also gets an `owner` role with `<app>:access.manage` (reserved: no manifest can declare it).
    Its **owners** decide who can use the app: they give and take its roles and answer its access requests.
    A team role granting `<app>:access.manage` makes its members owners too.
  - App roles follow the manifest; admins can't edit them. A role the app no longer declares is marked
    stale, and its holders keep it until an admin deletes it.
- **Default grants.** A new permission is granted to its `defaultRoles` once, the first time it appears;
  after that, the admin panel owns the role settings. Permissions that disappear are marked stale, not
  deleted.
- **Enforcement.**
  - **Server (the actual security check):** endpoints require the app's access permission by default;
    annotate one with `.annotate(RequiredPermission, sales.perm("orders.refund"))` for more.
  - **UI (convenience only):** `<Can permission=...>` and `useCan()`. The shell hides apps a user can't
    open and guards their routes centrally.
- **Changes apply at once.** When someone's roles change, the next request carries their new grants, and
  open browsers reload the session: an app appears or disappears without a reload.

## The backend

```ts
// server/main.ts
runApp({
  app: sales,
  api: SalesApi,
  handlers: Handlers.pipe(Layer.provide(Database.layer({ serviceId: sales.id, migrations }))),
  events: EventHandlers,
})
```

`runApp` serves the API with access control, registers the manifest with the platform at startup, serves
`/.well-known/mosaik-app.json` and `/health`, and wires logging and tracing. Handlers get the
`CurrentPrincipal` (who is calling and what they may do), plus these services from `@mosaik/sdk/server`:

- **`Audit`** records an action in the central audit log, attributed to the user.
- **`Notify`** and **`Messages`**: see [below](#notifications-and-messages).
- **`Events`**: see [Platform events](#platform-events).
- **`Live.eventStream`** serves Server-Sent Events, consumed in the browser with `createEventStream`.

### Databases

An app with `database: true` gets its own Postgres role and database, `mosaik_<id>`.

- **Migrations** live in `server/migrations/` and run on startup.
- **SQL style:** write snake_case SQL; rows come back in camelCase.
- **Installed apps** get a `DATABASE_URL` from the platform (image apps), or bring their own.
- **Built-in apps** (and the examples in development) connect with `DB_SERVER_URL` and
  `DB_PASSWORD_SECRET` (passwords are derived, so nothing is stored); `bun db:provision` creates the
  databases. Set `DATABASE_URL` (in development, `DATABASE_URL_<ID>`) to use an external one.

## Pages

An installed app's `web/index.tsx` default-exports `defineWebApp`, built into its own bundle by
`mosaikApp()` (`@mosaik/sdk/build/vite`) and served by its backend at `/apps/<id>/`. A built-in app's pages are
file-based routes in `web/routes/`, compiled into the shell.

```tsx
export default defineWebApp({
  component: () => <AppLayout app={app} nav={[{ to: "/crm", label: "Deals", exact: true }]} />,
  routes: (parent) => [
    createRoute({
      getParentRoute: () => parent,
      path: "/",
      staticData: { title: "Deals", keywords: ["pipeline"] },
      validateSearch: searchValidator(DealsSearch),
      component: lazyRouteComponent(() => import("./pages/deals")),
    }),
  ],
})
```

`bun run dev` (`runAppDev` from `@mosaik/sdk/build/dev`) rebuilds the bundle on every change and restarts the
backend, so it registers the new bundle: reload the page to see a change.

- **Frame.** `AppLayout` shows the app's name and icon from the manifest, its sub-navigation (items with a
  `permission` are hidden from people without it) and the page.
- **State in the URL.** Filters, sorting and pagination live in typed search params: the route validates
  them with `searchValidator(Schema)`, ideally the same Schema as the API query. An installed app's page
  reads and writes them with `const [search, setSearch] = useSearchParams(Schema)`, since its routes are
  created at runtime and it cannot import them; a built-in app's page uses its `Route`. Server-side tables
  use `useTableSearch` from `@mosaik/sdk/portal`. Discrete changes push history entries; typing replaces the
  entry. `examples/sales` puts it together with a server-side table.
- **Freshness.** `<QueryFreshness query={q} />` next to data shows "Updated 2 min ago", stale warnings and a
  refresh button. Data older than the response (cached aggregates, external APIs) returns `Fresh(schema)`
  from the API with the real `asOf`. Live streams use `<Freshness live />`.
- **Command palette (Ctrl/⌘+K).**
  - Pages appear when their route has `staticData: { title, keywords?, permission? }`.
  - Pages add contextual commands with `useCommands(() => [...])`.
  - To search the app's own data, default-export `defineSearchProvider({...})` from `web/search.ts`. It is
    built as a separate file, loaded the first time the palette opens, and gets 5 seconds per query.
  - Results rank by how much the user uses each app. Tab on any page of an app searches only that app.
- **Errors stay inside the app.** A page that throws shows "<App> ran into a problem" in place of the page;
  an installed app that cannot be loaded shows "<App> could not be loaded" with *Try again*. The shell and
  the app's navigation keep working. Apps are trusted code in the same page, though: one that blocks the
  main thread still affects the shell.

## Notifications and messages

Every backend gets two services, both delivered by the notifications service:

- **`Notify`** tells *users* about something. Each user chooses per type where they get it: in-app (bell
  and inbox), e-mail or Slack.
- **`Messages`** sends exact content to exact places: e-mail addresses, users' e-mail, or Teams/Slack channels.

### Notifications

Declare the types in the manifest (`notifications`). They are registered when the backend starts and appear
in every user's notification settings.

```ts
const notify = yield* Notify
yield* notify.send({
  type: sales.notification("order.refunded"),                  // type-checked
  audience: Audiences.permission(sales.perm("orders.refund")), // or Audiences.users(id, …) / Audiences.everyone
  exclude: [actor.id],                                         // e.g. whoever triggered it
  content: { title: `${order.number} was refunded`, link: `/sales/orders?search=${order.number}` },
  idempotencyKey: `refund-${order.id}`,
})
```

- **Audience.** A permission audience is everyone whose roles grant it (wildcards and the built-in roles
  included), resolved when the notification is sent.
- **Channels.** Users choose per type at `/notifications/settings`; until they do, `defaultChannels` apply.
- **In-app.** The bell shows the unread count and the newest items live, with a toast for each new one.
- **Failures.** A failed `send` returns `NotifyError` and is logged. Callers usually ignore it, so a
  notification never fails the action that triggered it.

### Messages

```ts
const messages = yield* Messages
yield* messages.send({
  to: [To.user(order.ownerId), To.email("finance@partner.com", "Finance"), To.target("sales")],
  kind: "refund-report",                // shown in the delivery log; admins can route it
  idempotencyKey: `refund-${order.id}`, // optional: retries never send twice
  content: {
    title: `Refund approved for ${order.number}`,
    body: "Plain text. Blank lines separate paragraphs.",
    fields: [{ label: "Amount", value: "€120.00" }],
    link: `/sales/orders/${order.id}`,  // app path or https URL, shown as a button
    severity: "success",                // info | success | warning | critical
  },
})
```

- **Destinations.** `To.user(id)` reaches a user at their account address. `To.email(address)` must match
  `MAIL_ALLOWED_DOMAINS`. `To.target(id)` posts to a Teams or Slack channel an admin configured (which can
  be limited to some apps). Duplicates are delivered once.
- **Delivery.** `send` succeeds once the message is queued and fails with `MessageError` (`Rejected`,
  `RateLimited` or `Unavailable`). Deliveries are retried with backoff; rejections are not. Delivery is at-least-once.
- **Content** is channel-neutral: the service renders it as HTML and plain-text e-mail, Slack Block Kit and
  Teams Adaptive Cards, escaping everything.

## Platform events

An app subscribes in its manifest (`events`) and handles each event in its backend:

```ts
// server/events.ts
export const EventHandlers = Events.handlers(crm, Effect.gen(function* () {
  const deals = yield* Deals
  return {
    "user.deleted": ({ userId }) => deals.unassign(userId),
    "user.access_changed": ({ userId, hasAccess }) => (hasAccess ? Effect.void : deals.unassign(userId)),
  }
}))
```

| Event | Data |
|---|---|
| `user.created` | `{ user: { id, email, name, image } }` |
| `user.deleted` | `{ userId }` |
| `user.access_changed` | `{ userId, hasAccess, grants }`: the user's roles changed, or a role's grants; `grants` are scoped to the app like its tokens |

- **Recording.** Changes are recorded in the same transaction, however they are made (admin panel, sign-up,
  an owner giving a role), and kept in one ordered log (`EVENT_RETENTION_DAYS`, default 30).
- **Delivery.** The SDK asks the platform for the app's next events, runs the handlers in order and
  acknowledges them. Delivery is at-least-once and in order: make handlers safe to repeat (`event.id`).
  A failing handler is retried with backoff before any later event.
- A newly subscribed app starts with events from then on; one away for longer than the retention gets its
  `missed` handler.

## Connectors

`@mosaik/sdk/connectors` has server-side clients for external systems. Build one with `Connector.make`:

- base URL and authentication: `Auth.bearer`, `basic`, `header`, `clientCredentials`, or `entra` (Entra ID
  app-only tokens);
- timeouts, retries with backoff, and client-side rate limiting (429 aware);
- schema-decoded responses, typed `ConnectorError`s, and a trace span per request;
- `Connector.cache(lookup, { ttl, source })`, which caches lookups and returns `Fresh` data.

**Jira** (`@mosaik/sdk/connectors/jira`) works with Cloud and Data Center: `JIRA_URL` plus `JIRA_TOKEN` (Data
Center) or `JIRA_EMAIL` + `JIRA_API_TOKEN` (Cloud). Without `JIRA_URL` outside production, or with
`CONNECTORS_MODE=fixtures`, it serves sample data. `examples/issues` uses it.

## Standalone apps

A standalone app serves its own page on its own address, with its own header and styles, and still uses
Core: sign-in, permissions and roles, owners and access requests, audit, notifications, messages and
events. `examples/notes` is one (`bun dev --headless` runs it with Core alone).

- **Manifest.** No `portal` section: the shell does not list it.
- **Page.** `index.html` at the app's root, built with `mosaikApp({ standalone: true })` in
  `vite.config.ts`: a normal single-page app that bundles what it uses (nothing comes from the shell).
- **Backend.** The same `runApp`. Given its public address (`MOSAIK_PUBLIC_URL`) and Core's (`MOSAIK_URL`),
  it serves the page at `/` and signs people in:
  - `/auth/sign-in?return=/path` sends the browser to Core's sign-in page and back; `/auth/callback`
    finishes it; a form posting to `/auth/sign-out` signs out of the app.
  - The tokens stay in an encrypted, HTTP-only cookie and become `Authorization: Bearer` on every request,
    so `AccessControl` and `RequiredPermission` work as they do behind the gateway.
  - `/api/auth/identity/session` says who is signed in and what they may do (a `SessionInfo`, as in the
    shell). People who are not signed in get no token: the API answers 401.
- **Calling the API.** `makeApiClient(Api)` as in the Portal; requests go to the app's own address.
- **Managing it.** Its owners and the admins give its roles and answer its requests in Core's console
  (`/manage/<id>`), as for every app.
- **Running it.** Core must know the app (`CONFIGURED_APPS`) and the app its key; see
  [Operating Mosaik](operations.md#standalone-apps).

## Shipping an app

- **SDK.** Until it is published, apps install the SDK from a tarball: `bun sdk:pack` builds
  `dist/sdk/mosaik-sdk-<version>.tgz` (TypeScript sources, which Bun and Vite read as they are), and
  `bun create:app <id> --dir <path> --sdk-only` refreshes an app's copy in `vendor/mosaik/`.
- **Image.** `bun run image` builds the app's Docker image, which carries `mosaik-app.json` (the manifest
  with its built browser bundle). Operators install it on the Portal's Apps page (`/portal/apps`); see
  [Operating Mosaik](operations.md#installing-apps).
- **Compatibility.** Apps declare the platform major version they were built for; others are refused. A
  platform major release means rebuilding every app. Bump `version` in the manifest for every release.
- **Shared modules.** Solid, the router, Query, Effect and the SDK's page entry points (`@mosaik/sdk`,
  `/client`, `/solid`, `/portal`, `/ui`, `/table`, `/charts`) come from the shell through an import map,
  so mounted apps leave them out of their bundles. A standalone page bundles what it uses.
- **Styles.** Each app generates its own Panda runtime with its id as class prefix (`crm-…`), so its atomic
  classes never collide with the shell's.
