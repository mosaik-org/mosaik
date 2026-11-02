# Mosaik

Mosaik is a platform and SDK for a company's internal apps. Teams build apps (dashboards, tools, admin
panels, workflows) and Mosaik gives them one place to live: one login, one shell, roles and owners,
notifications, events, search, and a directory where people find the apps they need and ask for access.

Apps are separate pieces: each has its own backend, database and release cycle, built-in or installed
at runtime from its team's repository. Together they look and work like one product.

Mosaik comes in two layers ([Architecture](docs/architecture.md)):

- **Mosaik Core:** the primitives. Sign-in, permissions and roles, app owners and access requests, audit,
  notifications and messages, platform events, settings, databases, file storage, and AI clients using apps
  through MCP. Any app can use Core alone, as a
  *standalone* app on its own address with its own page.
- **Mosaik Portal:** the shared product built on Core. The shell everyone uses, the directory of apps,
  pins and usage, and installing and running apps. Apps *mounted* in the Portal share its sign-in,
  navigation and look.

- **For people using it:** one sign-in (email/password or Microsoft Entra ID), the apps they use pinned
  in the sidebar, a directory of every app with a way to request access, one inbox for notifications,
  a command palette (Ctrl/⌘+K) that searches pages and data across apps, and their AI client (any client
  of the Model Context Protocol) using apps as them through Mosaik's MCP server.
- **For app teams:** an SDK that handles authentication, permissions, roles, audit, notifications, e-mail,
  Slack and Teams messages, platform events, databases and a consistent UI kit. An app is a manifest,
  an API contract, a backend and pages, mounted in the Portal or standalone with the same code.
- **For admins:** users and roles, app owners who decide who can use their app, app installation from a
  URL or a Docker image, usage numbers, notification routing and an audit log.

Built with Bun and Effect 4 on the server, Solid, TanStack Router/Query/Table, Ark UI, Panda CSS and
ECharts in the browser, and Postgres.

## Quick start

```sh
bun install
bun infra:up     # Postgres + Jaeger + Mailpit (docker)
bun dev          # provisions databases, runs everything
```

Open http://localhost:5173 and log in as `admin@mosaik.local` / `admin12345` (see `.env.example`).
`bun dev --headless` runs Core alone: its console at http://localhost:5173 (for admins and app owners) and
the standalone example, Notes, at http://localhost:4300. Everything signs in on Core's page.
Traces: http://localhost:16686 (set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` in `.env`).
E-mails sent in development: http://localhost:8025 (Mailpit).

| Command | |
|---|---|
| `bun dev [--headless] [ids...]` | Run Core, the Portal and the examples (optionally only some apps); `--headless`: Core and standalone examples only |
| `bun create:app <id> [--dir path] [--db]` | Create an app in its own repository, installed at runtime |
| `bun create:app <id> --builtin [--db] [--public]` | Create a built-in app, part of the platform (`apps/<id>`) |
| `bun sdk:pack` | Pack the SDK (`@mosaik/sdk`) as one tarball into `dist/sdk/` |
| `bun examples:verify [ids...]` | Typecheck and build the examples against the packed SDK, outside the workspace |
| `bun db:provision` | Create per-service databases (idempotent) |
| `bun typecheck` / `bun lint` / `bun test` | TypeScript 7, Biome + boundary checks, Vitest |
| `bun run build` | Build the shell and the console |

## Documentation

- **[Architecture](docs/architecture.md):** Core and Portal, what each owns, the APIs between them and
  standalone apps.
- **[Building apps](docs/apps.md):** the manifest, permissions and roles, the backend, pages, search,
  notifications, messages, platform events, connectors, standalone apps and shipping an app.
- **[Operating Mosaik](docs/operations.md):** deployment and configuration, installing and running apps,
  access and app owners, notification channels.
- **[Contributing](CONTRIBUTING.md):** checks, git hooks, commit messages, versions and migrations.
  AI agents start with [AGENTS.md](AGENTS.md).

## Architecture

```
Browser ── shell (Portal) ──► Gateway (Core)
                                ├─ /api/auth/*          → auth (sessions, Better Auth, sign-in for standalone apps)
                                ├─ /api/admin/*         → auth (users, roles, audit)
                                ├─ /api/notifications/* → notifications (inbox, settings, admin)
                                ├─ /api/platform/*      → platform (who can use apps, access requests, apps' settings and storage)
                                ├─ /api/portal/*        → portal (catalog, pins and usage, installs)
                                ├─ /api/<id>/*          → app <id> (route from the platform's registry)
                                │    + Authorization: Bearer <token for that app only>
                                └─ /mcp                 → mcp (AI clients, with their own access token)

Apps ── /api/platform/v1 (app key) ──► platform ──► auth (permissions, roles, audit)
                                                 ├─► notifications ──► SMTP, Slack, Teams
                                                 └─► SeaweedFS (S3: apps' files)
Portal ── /internal (service key) ──► platform (app identities, databases, events)

Browser ── standalone app (own address, own page) ── sign-in ──► Core (OAuth: /api/auth/oauth/*)

AI client ── /mcp ──► mcp ── tools from apps' contracts ──► apps (a token for the person, per call)
          └─ sign-in ──► Core (OAuth 2.1 + PKCE: /api/auth/agents/*)
```

**Core** (`services/auth`, `notifications`, `platform`, `mcp`, `gateway`):

- **Gateway.** The only public entry point.
  - It exchanges the session cookie for a short-lived (60 s) Ed25519-signed token carrying the user and
    their grants, issued for one service only (its `aud`). Upstream services never see cookies; app
    tokens carry only `*` and the app's own grants. Visitors get a token too, with the `anonymous` role's grants.
  - Tokens are cached per session and service, and dropped the moment the auth service reports that the
    user's access changed, so changes apply on the next request.
  - Platform services are routed from `UPSTREAM_*` variables; apps from the platform's registry, which
    the platform streams to the gateway whenever it changes.
- **Auth service.** Better Auth, roles and grants, the registry of apps with their permissions and roles,
  the audit log and the token signing keys (`/.well-known/jwks.json`). It serves the admin API, streams
  access changes (Postgres `LISTEN/NOTIFY`) to the gateway and to browsers, and serves the one sign-in
  page everything uses, with OAuth for standalone apps.
- **The console.** Core's web UI for admins and app owners: Administration, the apps someone manages and
  access requests. Without the Portal, the gateway serves it; the shell mounts the same pages.
- **Notifications service.** Delivers what apps send: in-app notifications, e-mail (SMTP), Slack and Teams.
  It keeps an outbox, retries failed deliveries, and serves users' inbox and channel settings.
- **Platform service.** App identities and keys, and the platform API apps call with their key: registering
  their manifest, audit entries, messages and notifications, platform events, settings and files. It
  provisions apps' databases, stores apps' files in SeaweedFS within their limits, keeps apps' settings,
  runs access requests, and gives the Portal its registry API.
- **MCP service.** Mosaik's MCP server for people's AI clients. It reads the tools apps offer
  (`AgentTool` on their contracts), lists each person only those they may call, and calls apps as that
  person. AI clients sign in through the auth service (OAuth 2.1 with PKCE, once per client) and stay
  connected as long as the person's Core session; the audit log names the client.
- **Apps.** Each backend checks tokens locally against the platform's JWKS (no call per request) and
  enforces each endpoint's permission. Every app serves its manifest at `/.well-known/mosaik-app.json`.

**Portal** (`shell`, `services/portal`, `apps/`):

- **Shell.** The single-page app everyone uses: sign-in, sidebar, directory, app pages, inbox and command
  palette. It mounts every app at `/<id>`: built-in apps are compiled in, installed apps' code loads the
  first time someone opens them.
- **Portal service.** Installs apps (by URL or Docker image) and runs image apps, checks their health,
  and serves the catalog, pins, usage and categories. It uses Core only through Core's APIs, like an app.

## Repository

```
shell/            The Portal's web shell: layout, directory, inbox; mounts the console's pages and apps/*/web/routes at /<id>
console/          Core's console app: frames the console's pages when Mosaik runs without the Portal
services/
  gateway/        Core: reverse proxy, session → token exchange, serves the built shell in production
  auth/           Core: Better Auth, roles and grants, app registry, audit log, admin API, OAuth for standalone apps and AI clients
  mcp/            Core: the MCP server for AI clients: apps' tools per person, calls as the person
  notifications/  Core: outbox, worker, channels (e-mail, Slack, Teams), inbox, settings, routing
  platform/       Core: app identities and keys, platform API, events, databases, access requests
  portal/         Portal: installing and running apps, catalog, pins, usage and categories
apps/<id>/        The Portal's built-in apps: admin (lists Core's administration), portal (installs, usage), status
  manifest.ts     id, permissions, roles, notifications, database (isomorphic)
  api/            HttpApi contract shared by server and web (isomorphic)
  server/         Backend process (Bun + Effect)
  web/routes/     Pages (file-based TanStack routes, compiled into the shell)
examples/<id>/    Example apps, written like a team's app; `bun dev` runs them
                  sales, issues: mounted in the Portal; web/index.tsx is the bundle (defineWebApp) the shell loads
                  notes: standalone, its own page (index.html) and sign-in through Core
packages/         The SDK and shared code
  sdk             @mosaik/sdk, the one package apps use: entry points per side and layer, re-exporting the packages below
  core            Manifests, permissions, roles, principal, errors, AccessControl contract
  auth            contract (tokens, internal, admin and OAuth APIs, AI clients' sign-in) · server (verification, middleware) · web (session, <Can>, live access)
  server          runApp: HTTP, access control, registration, Audit, Messages, Notify, Events, Live (SSE), standalone sign-in, tools for AI clients, observability
  tools           Apps' tools for AI (Core): the catalog of what apps offer (AgentTool), calls to them as a person; used by mcp
  notifications   contract (content, destinations, audiences, internal and browser APIs)
  platform        contract (app manifest, platform API, registry, access) · server (PlatformClient, app keys)
  portal          The Portal's package: contract (catalog, workspace, installs, permissions) · web (defineWebApp, what the shell mounts) · build (the mounted bundle, the shared-module list)
  console         Core's console pages (administration, apps people manage, access requests), mounted by both UIs
  app-kit         Building apps (Core): the standalone page, the app's Panda config and styles, the dev loop, the manifest
  db              Postgres layer + migrations, per-service provisioning
  client          Typed browser API client and formatters · solid (query defaults, event streams)
  mosaik-ui       @mosaik/mosaik-ui: the components apps import; Solid on Ark UI + Panda, standing alone (it imports nothing of Mosaik); see its README
  table           DataTable (TanStack Table, client or server-side)
  charts          ECharts wrapper drawing with the theme's tokens (chart.1…6, text, lines), option builders
  web-kit         Mosaik's page pieces: AppLayout, NavTabs, QueryBoundary, AppIcon, the command palette, forms and actions, Toasts
  connectors      Server-side clients for external systems (Jira, SMTP, Slack, Teams)
  styled-system   Mosaik's theme for @mosaik/mosaik-ui, the generated runtime and the kit's stylesheet
tooling/          Dev runner, provisioning, scaffolding, boundary checks
infra/            compose.dev.yml (local infra), compose.yml + Dockerfile (deployment)
docs/             Architecture, building apps, operating Mosaik
```

`bun lint` also checks the boundaries between them:

- Apps never import other apps.
- Browser code never imports server-only modules.
- Contracts (`manifest.ts`, `api/`, `@mosaik/core`) stay isomorphic: they work in the browser and on the server.
- App servers never import browser code.
- Shared packages never depend on apps.
- Examples see only the SDK (`@mosaik/sdk` and its entry points, each on its side) and their own files,
  like a team's app in its own repository.
- Core (its services and the shared packages) never depends on the Portal.
- The Portal (its service, the shell, built-in apps) uses Core only through its contracts and the SDK.

## License

MIT: see [LICENSE](LICENSE). `@mosaik/mosaik-ui` started from Park UI and draws icons from Lucide; their
notices are in [its LICENSE](packages/mosaik-ui/LICENSE).
