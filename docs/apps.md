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
bun create:app crm --dir ../crm --db                     # its own repository, with the SDK and components in vendor/mosaik/
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
4. Build pages with `createApi(Api)` (`@mosaik/sdk/solid`), the components of `@mosaik/mosaik-ui`, `@mosaik/sdk/table` and `/charts`.

## The SDK

Apps depend on one package, `@mosaik/sdk`, versioned like the platform. Its entry points follow where
code runs and which layer of Mosaik it needs:

| Import | Where | What |
|---|---|---|
| `@mosaik/sdk` | everywhere (`manifest.ts`, `api/`) | `defineApp`, permissions and roles, `Setting`, `Principal`, errors, `AccessControl`, `RequiredPermission`, `AgentTool`, `Fresh`, platform event types |
| `@mosaik/sdk/server` | `server/` | `runApp`, `Audit`, `Notify`, `Messages`, `Events`, `Settings`, `Status`, `Storage`, `Live`, `Database` and migrations |
| `@mosaik/sdk/connectors`, `/connectors/jira` | `server/` | clients for external systems; `/connectors/jira/model` is isomorphic |
| `@mosaik/sdk/client` | any page | `makeApiClient`, error helpers, formatters, the session API, the shell's contract (`toast`, `pageTheme`, `markBusy`); no framework |
| `@mosaik/sdk/solid` | Solid pages | `createApi`, `useAction`, `createForm`, `usePrincipal`, `useCan`, `<Can>`, `createEventStream`, `createQueryClient`, `usePageTheme`, `useBusy`, `useStatus`, `<Toasts />` |
| `@mosaik/sdk/portal` | pages mounted in the shell | `defineWebApp`, `AppLayout`, `NavTabs`, `FrameHeader`, `FRAME_TOP`, `useSearchParams`, `useTableSearch`, `useCommands`, `defineSearchProvider` |
| `@mosaik/sdk/ui`, `/table`, `/charts`, `/css` | pages | Mosaik's own components (`AppIcon`, `appColor`, `QueryBoundary`, `QueryFreshness`, `DataTable`, charts), the app's styling runtime; `/ui/styles.css` is the kit's stylesheet for a standalone page |
| `@mosaik/mosaik-ui` | pages | the components: [its README](../packages/mosaik-ui/README.md). A package of its own, which apps install next to the SDK, at the version the SDK names |
| `@mosaik/sdk/build/*` | `vite.config.ts`, `panda.config.ts`, `scripts/` | `mosaikApp`, `appPandaConfig`, `runAppDev`, `writeAppManifest` |

- **Core or Portal.** An app that imports nothing from `@mosaik/sdk/portal` runs without the Portal
  (standalone); the rest of the SDK is Core, and the components work either way. `bun lint` checks that
  only `/portal` and `mosaikApp()` (whose default is the bundle for the shell) reach the Portal's code.
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
  settings: {                  // how it behaves, changed by its owners while it runs (see Settings)
    refundLimit: Setting.number({ label: "Largest refund", unit: "EUR", min: 0, default: 500 }),
  },
  database: true,              // a Postgres database of its own
  storage: true,               // files kept by the platform (see Files)
  portal: {
    icon: "chart-line",
    color: "teal",             // its icon's colour, one of `appColors`; without it, one picked from the id
    category: "Sales",         // where All apps lists it (owners and admins can change it)
    config: {                  // environment variables admins enter when the Portal runs the app's image
      PAYMENTS_URL: { label: "Payments API", kind: "url", description: "Base address of the payments API" },
    },
    pages: [                   // tabs in the shell's top bar, beside the app's name
      { title: "Overview", path: "/" },
      { title: "Orders", path: "/orders" },
      { title: "Refunds", path: "/refunds", permission: "orders.refund" },
    ],
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
- **`Settings`**: see [Settings](#settings).
- **`Storage`**: see [Files](#files).
- **`Live.eventStream`** serves Server-Sent Events, consumed in the browser with `createEventStream`. Its
  address can be an accessor (`` () => `/api/orders/live?region=${region()}` ``): the stream connects again
  only when the address changes, and waits while it is `undefined` (until what it needs has loaded).

### Databases

An app with `database: true` gets its own Postgres role and database, `mosaik_<id>`.

- **Migrations** live in `server/migrations/` and run on startup.
- **SQL style:** write snake_case SQL; rows come back in camelCase.
- **Installed apps** get a `DATABASE_URL` from the platform (image apps), or bring their own.
- **Built-in apps** (and the examples in development) connect with `DB_SERVER_URL` and
  `DB_PASSWORD_SECRET` (passwords are derived, so nothing is stored); `bun db:provision` creates the
  databases. Set `DATABASE_URL` (in development, `DATABASE_URL_<ID>`) to use an external one.

## Pages

**Components.** Pages import them from [`@mosaik/mosaik-ui`](../packages/mosaik-ui/README.md) (Ark
UI and Panda CSS, accessible, with dark mode); its README has the whole set:

- **Parts**, named after Ark's: `<Dialog.Root>`, `<Tabs.List>`, `<Menu.Item>`. Each takes all of Ark's props.
- **Fields** for forms, taking plain values (`TextField`, `SelectField`, `DatePickerField`, ...). Each puts a label,
  the control, help and the error together.
- **Ready-made components:**
  - dialogs: `Modal`, `ConfirmDialog`, `ActionMenu`;
  - states: `EmptyState`, `ErrorState`;
  - page parts: `Stat`;
  - the theme: `ThemeProvider`, `ThemeToggle` (for a standalone page; in the shell, the shell's).
- **The look of the catalog:** `bun run catalog` in `packages/mosaik-ui` shows every example
  at http://localhost:6006.

Styles name the theme's tokens:
- surfaces and text: `canvas`, `fg.default`, `fg.muted`, `fg.subtle`, `border`;
- grays: the `gray` palette, e.g. `gray.surface.bg`, `gray.subtle.bg`;
- roles: `accent`, `danger`, `success`, `warning` (e.g. `accent.solid.bg`, `danger.plain.fg`, `success.subtle.bg`);
- fonts: `body` (Geist) and `mono` (Geist Mono). The shell loads them; a standalone page gets them with
  `@mosaik/sdk/ui/styles.css`. `@mosaik/mosaik-ui` alone names no font: a page on it keeps its own.

`colorPalette` picks a role for a component, as in `<Badge colorPalette="success">`.

An app's own styles define none of these: they read the page's variables (`var(--mk-colors-fg-muted)`).
A theme set at runtime, dark mode included, reaches them too. In TypeScript, use `token.var("colors.fg.muted")`
(the variable) rather than `token(...)` (the value at build time) for anything that should follow the
theme.

Charts (`@mosaik/sdk/charts`) draw on a canvas, where CSS variables mean nothing, so `<Chart>` reads the
theme's values from the page where it is drawn, and again when the theme changes. Series take the theme's
`chart.1`…`chart.6` colors in order (the accent first); for something that goes with a series outside the
chart, such as a legend of the app's own, use the same token: `css({ color: "chart.1" })`, or
`token.var(CHART_COLORS[i])`.

**The shell's contract.** Some things on a page belong to the shell, not to an app. Apps ask for them
through `@mosaik/sdk/client`, which works whatever the page is built with:
- **Toasts:** `toast.success("Saved")`, `toast.error("Could not save", reason)`. They show with the
  shell's toasts. `useAction` uses them too.
- **The theme:** `pageTheme()` and `onPageThemeChange(listener)`, or `usePageTheme()` in Solid, for
  what CSS does not style (charts). People choose the theme in the shell (its account menu), and every app follows it.

An installed app's `web/index.tsx` default-exports `defineWebApp`, built into its own bundle by
`mosaikApp()` (`@mosaik/sdk/build/vite`) and served by its backend at `/apps/<id>/`. A built-in app's pages are
file-based routes in `web/routes/`, compiled into the shell.

```tsx
export default defineWebApp({
  component: () => <AppLayout app={app} />,
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

- **Calling the API.** `createApi(Api)` (`@mosaik/sdk/solid`) turns the contract into what pages need:
  - queries keyed by the contract, `useQuery(() => sales.orders.list.query({ query }))` (the key is
    `["sales", "orders", "list", request]`, so nobody writes keys by hand);
  - `sales.orders.key()`, `sales.key()`: everything under a group, or the whole API, to refetch;
  - `useAction(sales.orders.refund, { success, failure, invalidates: [sales.orders] })` for calls that
    change something. It shows the outcome as a toast, refetches what it affects and tracks
    `pending()`. Use `run(request)` from buttons and menus (a failure becomes a toast; it resolves to
    whether it worked), and `submit(request)` from forms (a failure is thrown for the form to show).
- **Forms.** `createForm({ schema, initial, onSubmit })` checks a form with a Schema, usually the API's own
  payload Schema, so the form refuses what the server would:
  - `{...form.field("email")}` on a `TextField` binds the value and shows the field's problem once it was
    edited and left, or a submit was tried; the Schema's check messages are what people read;
  - `form.submit` validates, then calls `onSubmit` with the decoded value (for a `Schema.Class`, the instance
    the API client sends);
  - `form.error()` is why the last submit failed (the API's answer, such as a conflict), `form.submitting()`
    and `form.reset()` the rest.

  ```tsx
  const refund = useAction(sales.orders.refund, { success: "Refunded", invalidates: [sales] })
  const form = createForm({
    schema: Refund,
    initial: { reason: "" },
    onSubmit: (payload) => refund.submit({ params: { id }, payload }),
  })
  <form noValidate onSubmit={form.submit}><TextField label="Reason" required {...form.field("reason")} /></form>
  ```

  `noValidate` leaves the checks to the Schema, so people read its messages instead of the browser's.
- **Frame.** `AppLayout` shows the app's icon and name from the manifest, its pages as tabs and its
  `actions` in the frame's top bar, and the page below.
- **The top bar.** Its left side is the page's: what a page puts in `<FrameHeader>` shows there while
  it is open (a title, navigation, buttons), with the shell's search, assistant and account on the
  right. It stays the page's own, its data and handlers; the deepest page's wins, so a layout route can
  show the app's name and a page replace it. A standalone page has no top bar, so it shows nothing
  there.
- **Pages.** An app with several pages lists them in its manifest (`portal.pages`), in order, with paths
  under its address (`/` is its first page). `AppLayout` shows them as tabs in the top bar, with each
  page's statuses, those that do not fit under *More*, and as a menu on the app's name on phones; where
  there is no top bar (Core's console), as tabs above the page. A page with a `permission` is listed only
  for people with it. An app of one page leaves them out.
- **Width.** A page says how much of the screen it takes in its route: `staticData: { layout: "wide" }`.
  `contained` (the default) is a centered column, for forms, settings and text; `wide` takes the whole
  width with the usual padding, for tables and dashboards (Sales' orders); `full` goes edge to edge,
  without padding, filling the height, for maps, boards and editors. The deepest route that declares a
  layout wins, so a layout route can set it for all its pages. A `full` page goes under the top bar,
  which is frosted: start its content `FRAME_TOP` down (`style={{ "padding-top": FRAME_TOP }}` on the
  page, or on a scroll area so what scrolls passes under the bar).
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
  - The assistant finds pages and records the same way, and links to them: a page's title and keywords,
    and a search provider's results (their `to`), decide what it can link to in the app.
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
- **In-app.** The bell shows a dot while something is unread, red if something `critical` is among
  the newest, and the newest items live, with a toast for each new one. So keep `critical` for what
  someone should look at now.
  Its panel lists the unread ones (all of them are at `/notifications`), under the day they came:
  each with your app's icon in its colour (a warning or a critical one in theirs), the title on one
  line and the start of the body's first paragraph after your app's name. Write the title so it
  stands alone, and put the gist first in the body.
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

## Statuses

An app tells people what waits for them beside its name in Mosaik's navigation: a number on the
app (or on one of its pages) in the sidebar, a dot when the sidebar is narrow, on its card in All apps,
in the Overview's *Needs you*, in the tab's title ("(3) Mosaik"), in the command palette, and to the
assistant and AI clients (`what_needs_me`). It declares its statuses in the manifest:

```ts
statuses: {
  "orders.pending": { description: "Orders waiting for approval", kind: "count", page: "/orders" },
  "import": { description: "Order import", kind: "running" },
  "payments": { description: "Payments", kind: "health" },
},
```

- **Kinds.** `count`: how many things wait (0 shows nothing); `new`: when the newest thing came, shown
  until the person next opens the app; `running`: work the backend does, with its progress when known;
  `health`: trouble, `warning` or `danger`, with what is wrong. `tone` (`attention`, `warning`, `danger`)
  says how much a count asks for attention.
- **For whom.** One person, or everyone with one of the app's permissions, who may open the app:
  `StatusAudiences.user(id)`, `StatusAudiences.permission(sales.perm("orders.edit"))`.
- **Setting them.** In the backend, typed by the manifest (a count takes a number, work running a
  progress); they show at once, live, in every open browser of the people concerned:

  ```ts
  const status = yield* Status.for(sales)
  yield* status.set("orders.pending", StatusAudiences.permission(sales.perm("orders.edit")), 3, {
    link: "/orders?status=pending",                         // where the things are, under the app's address
  })
  yield* status.replace("orders.mine", perPerson)          // every value at once, the others cleared
  yield* status.whileRunning("import", StatusAudiences.user(actor.id), (report) =>
    importOrders(rows, (done) => report(done / rows.length)))
  ```

  Set the value the app computed from its data, not a change to it: `replace` leaves nothing stale, and
  recounting from time to time (Sales does at startup and every five minutes, `server/pending.ts`) catches
  what changed elsewhere. Work running expires unless it is set again within five minutes, so a crash
  does not leave it spinning; `whileRunning` renews it and clears it however the work ends.
- **Leading to the things.** A number says something waits; people want to see what. Give each value
  a `link` to where the things are (a filtered list, the one item): *Needs you*, the command palette and
  the AI lead there (its page otherwise). On the page, show what waits, from the status itself:

  ```tsx
  const waiting = useStatus(sales.status("orders.pending"))   // @mosaik/sdk/solid, live
  <Show when={(waiting()?.count ?? 0) > 0}>
    <Button onClick={() => table.setFilters({ status: "pending" })}>Waiting for approval · {waiting()?.count}</Button>
  </Show>
  ```

- **Work in the page.** What only the browser tab knows (an upload, a long save) shows the same way, by
  the page it started on: `markBusy({ label: "Uploading 3 files" })` returns what ends it, `useBusy(() =>
  uploading(), { label })` ends it with the component; `keepOpen: true` asks before the page is left.
- **Tests.** `TestStatus` (in `AppTest`) holds the values as people would see them now:
  `yield* (yield* TestStatus).values("orders.pending")`.

## Settings

Settings are how an app behaves, changed by its owners and admins while it runs: a limit, a text, a switch.
The app declares them in its manifest, each with a default, so it works before anyone changes them:

```ts
settings: {
  refundLimit: Setting.number({ label: "Largest refund", unit: "EUR", min: 0, default: 500,
    description: "Larger refunds are refused here: finance handles them." }),
  exportsEnabled: Setting.boolean({ label: "Allow CSV exports", default: true }),
  banner: Setting.text({ label: "Notice on the orders page", multiline: true, maxLength: 280, default: "" }),
  defaultRegion: Setting.choice({ label: "Default region", options: { emea: "EMEA", na: "North America" }, default: "emea" }),
},
```

- **Where they are changed.** The app's management page (Manage apps → the app) gets a **Settings**
  tab, in the Portal and in Core's console, for its owners and admins. Each field shows who changed it and
  when, and goes back to the default in one click. Changes are checked against the declaration and
  recorded in the audit log (`app.settings.set`).
- **Reading them.** In the backend, typed by the manifest; read them when needed, not once at startup:

  ```ts
  const settings = yield* Settings.for(sales)
  const limit = yield* settings.get("refundLimit")   // number
  ```

  Changes arrive without a restart (`runApp` keeps asking the platform, like for events). While the
  platform cannot be reached, the app keeps the last values it had, the defaults before the first answer.
  `settings.changes` is a stream of all values, the current ones first, for what must react to a change.
- **Pages** see what the app's API gives them: Sales' pages ask `GET /api/sales/orders/options` whether
  exports are on, and hide the button.
- **Upgrades.** A value chosen before a newer version changed the declaration (a tighter limit, a removed
  option) gives way to the default; the Settings tab says so.
- **Settings or config.** Settings are for behavior, visible to the app's owners, applied while it runs.
  `portal.config` is for where things are and credentials (addresses, tokens): environment variables an
  admin sets when the Portal runs the app's image, secrets stored encrypted, applied by restarting it.
  Give config a `label` and a `kind` (`text`, `url`, `number`, `boolean`) so the form asks for it with the
  right field and checks it; the app still reads text (`true`/`false` for `boolean`).

## Files

An app that declares `storage: true` keeps files with the platform, within a limit admins set for it
(Manage apps → the app → Storage, where its owners see the usage). Files go through the app: it takes
uploads in its own API, checks them as it wants (type, content, size), stores them, and serves them. The
platform only stores and counts.

```ts
// api/: an upload endpoint, with the app's own limit per file
HttpApiEndpoint.post("attach", "/:id/attachments", {
  params: { id: OrderId },
  payload: Schema.Struct({ file: Multipart.SingleFileSchema }).pipe(
    HttpApiSchema.asMultipart({ maxFileSize: 10 * 1024 * 1024 }),
  ),
  success: Attachment,
  error: [NotFound, BadRequest, StorageLimitReached, StorageUnavailable],
})

// server/: store it, serve it
const storage = yield* Storage
const stored = yield* storage.put(`orders/${id}/${file.name}`, file)       // StorageLimitReached when full
return yield* storage.respond(`orders/${id}/${name}`, { inline: true })    // in a handler: the download
```

- **`Storage`** (`@mosaik/sdk/server`): `put` (bytes, text, a stream, a `Blob` or an uploaded file),
  `get` (a stream), `head`, `delete`, `list({ prefix })`. Keys are the app's own paths
  (`orders/123/invoice.pdf`, see `storageKeyProblem`); contents stream both ways.
- **Serving** with `storage.respond`: files are downloads, never shown as the app's page, so an uploaded
  HTML or SVG file cannot run scripts as the app. Images and PDFs may be shown in place (`inline`).
- **In a page**, `uploadFile(url, file, { onProgress })` (`@mosaik/sdk/client`) sends a file to the
  app's endpoint with progress, and `<FileUploadField>` (`@mosaik/mosaik-ui`) lets people choose it,
  refusing other types and sizes at once. Downloads are plain links to the app's API.
- **Size.** A request to the app is limited to 128 MB unless it sets `maxRequestBodySize` in `runApp`.
- Sales attaches PDFs and images to orders: `examples/sales` (`Attachments.tsx`, `server/http.ts`).

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

## AI clients

People can connect an AI client (any client of the Model Context Protocol) to Mosaik's MCP server and use apps
through it, as themselves. An app decides which endpoints it offers, with `AgentTool` on its contract:

```ts
HttpApiEndpoint.post("refund", "/:id/refund", { params: { id: OrderId }, payload: Refund, success: Order })
  .annotate(RequiredPermission, sales.perm("orders.refund"))
  .annotate(AgentTool, {
    title: "Refund an order",
    description: "Refunds a paid or shipped order in full. Refused above the largest refund in Sales' rules.",
    examples: ["Refund order SO-10045, the customer returned it"],
  })
```

- **What the AI sees.** A tool named `<app>_<group>_<endpoint>` (`sales_orders_refund`), with the title
  and description, and one input: `path`, `query` and `body`, each in its JSON form from the endpoint's
  schemas. The description is all the AI knows about when and how to use the tool: say what it does,
  what its inputs mean when their names do not, and what it refuses.
- **Examples.** Questions people might ask that the tool answers (optional). The assistant in the shell
  suggests them in a new conversation, to people who may use the tool, so write them as a person would.
- **Who sees it.** Only people who may call it (its `RequiredPermission`, or the app's access
  permission). Clients are told it changes nothing for a `GET`, and that it is destructive when its
  permission is `dangerous` in the manifest, so they ask the person first.
- **Calls are ordinary requests.** The MCP server calls the app's backend with a token for the person,
  as the gateway does: the same permission checks, validation and rules. Handlers change nothing for AI
  clients. `principal.agent` names the client (`null` otherwise), and `Audit.record` records it, so the
  audit log shows "Ada (via <the client's name>)".
- **What the AI gets back.** The response body as text; errors with their status and body, so a refusal
  like "Refunds above €500 are handled by finance" reaches the AI and it can explain it. Requests that do
  not match the contract are answered with a `BadRequest` saying what is wrong. Answers beyond 60,000
  characters are cut, with a note: offer paging (`pageSize`) on endpoints that can return a lot.
- **Limits.** Only endpoints taking JSON (no file uploads); `runApp` refuses to start when an offered
  endpoint takes anything else, or when a tool's name would exceed 64 characters.

Apps serve their tools at `/.well-known/mosaik-tools.json`; the MCP server reads them when apps are
installed or change. The assistant in the shell offers the same tools, with the person's approval for
every call that changes something (`principal.agent` is then "<brand> assistant"). Sales and Issues
offer theirs.

## Testing

`@mosaik/sdk/testing` tests an app's backend without a server or the platform (`bun run test`,
`*.test.ts`; the boundary check keeps it out of everything else):

```ts
const app = AppTest.layer({ app: sales, api: SalesApi, handlers: ApiHandlers.pipe(Layer.provide(InMemoryOrders(orders))) })

layer(app)("Sales", (it) => {
  it.effect("refunds above the limit go to finance", () => Effect.gen(function* () {
    const api = yield* AppTest.client(SalesApi)
    yield* (yield* TestSettings.for(sales)).set("refundLimit", 100)
    const error = yield* Effect.flip(api.as(refunder, (client) => client.orders.refund({ params, payload })))
    expect(error._tag).toBe("Conflict")
  }))
})
```

- **Calling the API as someone:** `AppTest.user({ grants })` or `AppTest.visitor`. Requests go through the
  app's real access control, with tokens signed for the test: `RequiredPermission`, the app's access
  permission, `Forbidden` and `Unauthorized` are as in production.
- **The platform's services stand in** and record what the app did: `TestAudit` (entries, with who),
  `TestNotify` and `TestMessages` (what was sent), `TestSettings` (set values the app reads at once;
  `TestSettings.for(app).set(name, value)` is typed), `TestStorage` (the files, and a limit to test running
  out of room), `TestEvents` (deliver a platform event to the app's handlers, given as `events`).
- **The app's own services:** give the handlers stand-ins of your own, as Sales does for its database
  (`server/Orders.memory.ts`). Keep the API's rules (permissions, settings, what is audited) in the handlers,
  so tests run them for real, and data rules in the service.
- **One layer, one app:** the tests of a `layer(...)` share the app's state, as requests share a running
  app; reset what a test changes (`TestSettings.reset`), or provide `AppTest.layer` per test.
- `examples/sales/server/http.test.ts` tests refunds, notifications and exports this way.

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
  - `/auth/request-access?return=/path` and `/auth/notification-settings` take people to Core's pages for
    asking for access to the app and choosing their notifications (and back).
  - The tokens stay in an encrypted, HTTP-only cookie and become `Authorization: Bearer` on every request,
    so `AccessControl` and `RequiredPermission` work as they do behind the gateway.
  - `/api/auth/identity/session` says who is signed in and what they may do (a `SessionInfo`, as in the
    shell). People who are not signed in get no token: the API answers 401.
- **Calling the API.** `createApi(Api)` and `createForm` as in the Portal (or `makeApiClient(Api)` from
  `@mosaik/sdk/client` without Solid); requests go to the app's own address.
- **Components.** The kit works there too.
  - Import its stylesheet once: `import "@mosaik/sdk/ui/styles.css"`, which carries the reset, the tokens
    and every component. A page without components needs it too: its own styles read those tokens.
  - Wrap the page in `ThemeProvider` (and offer `ThemeToggle`) for dark mode, and render `<Toasts />`
    from `@mosaik/sdk/solid` once: there is no shell to show `toast`'s toasts.
  - Its tokens are CSS variables a page's own CSS can use without Panda: `var(--mk-colors-fg-muted)`,
    `var(--mk-spacing-4)`.
  - `examples/notes` puts it together.
- **Links.** `standaloneLinks` from `@mosaik/sdk/client` builds them: `signIn(path)`, `requestAccess(path)`,
  `notificationSettings`, `signOut` (to post a form to).
- **Managing it.** Its owners and the admins give its roles and answer its requests in Core's console
  (`/manage/<id>`), as for every app.
- **Running it.** Core must know the app (`CONFIGURED_APPS`) and the app its key; see
  [Operating Mosaik](operations.md#standalone-apps).

## Shipping an app

- **SDK.** Until they are published, apps install the SDK and the components from tarballs:
  - `bun sdk:pack` builds `dist/sdk/mosaik-sdk-<version>.tgz` (TypeScript sources, which Bun and Vite
    read as they are), next to the components' (`mosaik-mosaik-ui-<version>.tgz`, built by the library);
  - `bun create:app <id> --dir <path> --sdk-only` refreshes an app's copies in `vendor/mosaik/`.
- **Image.** `bun run image` builds the app's Docker image, which carries `mosaik-app.json` (the manifest
  with its built browser bundle). Operators install it on the Portal's Apps page (`/portal/apps`); see
  [Operating Mosaik](operations.md#installing-apps).
- **Compatibility.** Apps declare the platform major version they were built for; others are refused. A
  platform major release means rebuilding every app. Bump `version` in the manifest for every release.
- **Shared modules.** Solid, the router, Query, Effect, the SDK's page entry points (`@mosaik/sdk`,
  `/client`, `/solid`, `/portal`, `/ui`, `/table`, `/charts`) and `@mosaik/mosaik-ui` come from the shell
  through an import map, so mounted apps leave them out of their bundles. A standalone page bundles what
  it uses.
- **Styles.** Each app generates its own Panda runtime, its classes prefixed with its id (`crm-…`) so they
  never collide with the shell's.
  - Its CSS holds only those classes, which read the page's tokens (`--mk-…`). The reset, the tokens and
    the components' styles come from the page: the shell's stylesheet, or `@mosaik/sdk/ui/styles.css`.
  - `mosaikApp()` sets this up (Panda's PostCSS plugin, keeping the app's layer), so an app has no
    `postcss.config` of its own.
  - The token names are a contract: an app built today keeps working as long as the names it uses
    exist, and removing one is a platform major release.
