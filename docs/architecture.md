# Architecture: Core and Portal

Mosaik is two layers. **Core** provides the primitives any app can use: sign-in, permissions and roles,
audit, notifications and messages, platform events, databases. **Portal** is the shared product built on
top: the shell everyone uses, the directory, installing and running apps. An app can use Core alone (a
*standalone* app on its own address, with its own page) or live in the Portal (*mounted* in the shell).

```
                ┌──────────────────────────── Portal ─────────────────────────────┐
                │  shell (web UI) · portal service (catalog, pins and usage,       │
                │  installing and running apps) · built-in apps (Administration…)  │
                └───────────────┬──────────────────────────────────────────────────┘
                                │ Core's public APIs and the SDK only
┌───────────────────────────────▼──────────── Core ────────────────────────────────────┐
│  auth (sign-in, sessions, users, roles and grants, app registry of permissions and     │
│  roles, owners and members, audit, signing keys, access changes, OAuth for standalone) │
│  notifications (notifications, messages, channels, inbox)                              │
│  platform (app identities and keys, the platform API, platform events, access          │
│  requests, databases, the route table)                                                 │
│  gateway (session → token for one app, forwarding by the route table)                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                ▲                                              ▲
     mounted apps (bundle in the shell)              standalone apps (own address, own page)
```

## The rule

The Portal uses Core only through Core's public APIs and the SDK: never Core's tables, never Core
services' code. Core never depends on the Portal. `bun lint` checks both directions. The Portal is
Core's first and biggest client, so whatever a standalone app needs, the Portal needed first.

## Who owns what

| Concern | Core | Portal |
|---|---|---|
| Sign-in, sessions, users | auth: Better Auth, the one sign-in page (everything signs in there), OAuth for standalone apps | — |
| Permissions, roles, owners, members | auth: the registry and its APIs; the console's app pages | the directory's app pages, linking to the console's |
| Access requests | platform: the workflow, its notifications, a page for asking; the console's review screens | the request dialog in the directory |
| Audit, notifications, messages | auth, notifications; the console's administration; a page for notification settings | the inbox, the bell, settings in the shell |
| Platform events | platform: the log, delivery to apps and to services | consumes `user.deleted` like any client |
| App settings | platform: values, checks, audit, delivery to running apps; the console's Settings tab | — |
| Statuses | platform: current values per person or permission, checked against manifests, live per person; Core's own (access requests computed, the assistant's set by it) | shows them in the sidebar, All apps, the Overview, the tab's title and the palette |
| App files | platform: storage in SeaweedFS (S3), per-app limits; the console's Storage tab | — |
| AI clients (MCP) | mcp: tools from apps' contracts, listed per person, calls as the person; auth: sign-in for AI clients, connections; the console's and account pages | — |
| The assistant | assistant: conversations, the model (a provider admins choose), turns with approvals; its panel (`packages/assistant`) | mounts the panel in the shell |
| App identity | platform: id, origin (configured or managed), key, status, address, registered manifest | creates the apps it installs |
| Databases | platform: provisions an app's database on request | asks for one when it runs an image |
| Administration | auth: users, roles, audit (`admin:*`, `/api/admin`); the console's pages | lists it as an app; its own pages for installs (`/portal`) |
| Routing | gateway: forwards by the route table (from the platform) | sets an app's address when it starts its container |
| Installing and running apps | — | portal: by URL or image, configuration (environment), health, rollback, logs |
| Listing apps | — | portal: catalog, categories, pins, recent apps, usage |
| UI | the console (admins and app owners) and Core's account pages (everyone) | the shell, built-in apps |

## The manifest

`defineApp` describes an app to Core: who it is (`id`, `name`, `description`, `version`) and what it needs
(`access`, `permissions`, `roles`, `notifications`, `events`, `settings`, `database`, `storage`). The Portal's part
sits under `portal`: `icon`, `category`, and the environment variables admins enter when the Portal runs
the app (`config`). The
built manifest (`mosaik-app.json`) carries the same split, with the browser bundle in `portal.web`.

Core stores the manifest an app registers and interprets only its own part. A standalone app leaves out
`portal`.

## APIs between them

- **Apps → Core:** the platform API (`/api/platform/v1`, the app key): register (with a standalone app's
  public address), audit, messages, notifications, events.
- **Portal → Core:** the platform's registry API (`/internal/registry`, the service key): create an app
  identity (Core returns the key once; the Portal stores it encrypted to start containers), set its
  address, enable or disable it, remove it, rotate its key, provision or drop its database, read
  registrations and event delivery status. The Portal receives platform events from the same log as apps,
  as the service `portal` (`/internal/events/services/portal`), and registers its own permissions
  (`portal:apps.manage`) with the auth service like an app's manifest.
- **Auth → platform:** who an app is and where it may send people back to (`/internal/clients`).
- **AI clients → Core:** the MCP server (`/mcp`), with an access token from the auth service's sign-in for
  AI clients (`/api/auth/agents/*`, OAuth 2.1 with PKCE). The MCP server follows the platform's routes,
  reads each app's tools (`/.well-known/mosaik-tools.json`) and calls apps directly with a token for the
  person, which it asks the auth service for on every call (`/internal/agent-token`).
- **Browser → the assistant:** `/api/assistant` through the gateway: conversations, and turns streamed as
  Server-Sent Events. The assistant uses the same catalog of tools (`packages/tools`) and calls apps
  with a token for the person that the auth service issues for each call (`/internal/user-token`), naming
  the assistant as the agent. Only one module knows the AI library (the AI SDK, for now); conversations
  are stored in the contract's own form, so another library or provider can continue them.
- **Browser → Core:** auth (`/api/auth`, `/api/admin`), notifications (`/api/notifications`), the platform's
  access requests and app pages (`/api/platform`), all through the gateway.
- **Browser → Portal:** catalog, pins and usage, categories, installs (`/api/portal`), through the gateway.
  The Portal is a platform service to the gateway (`UPSTREAM_PORTAL`): its tokens carry all of a user's
  grants, since owners change their app's category and operators install apps.

Which apps Core knows comes from two places: its configuration (`CONFIGURED_APPS=id=url,…`, keys derived
from `INTERNAL_KEY`: built-in apps with a backend, the examples in development, standalone apps) and the
Portal (apps it installs, with issued keys).

## Core's UI: the console and the account pages

Core has two UIs of its own, so it is complete without the Portal:

- **The console** (`packages/console`: the pages; `console/`: the app that frames them) is for running
  Mosaik and deciding who can use apps: Administration (users, roles & permissions, notification
  channels, deliveries, the audit log) for admins, and for app owners the apps they own (`/manage`, each
  app's roles, people and requests) and the queue of access requests. Anyone else who signs in is told
  it is for administrators and app owners.
- **The account pages**, rendered by the services themselves and needing no build, are for everyone:
  *sign in* (`/api/auth/sign-in`, the only sign-in: e-mail and password, Microsoft through a
  server-side redirect), *request access to an app* (`/api/platform/request-access/<id>`) and
  *notification settings* (`/api/notifications/preferences`, linked from every notification e-mail)
  and *AI clients* (`/api/auth/agents/connections`), with the consent page AI clients sign in through.
  They show the company's name, logo and colour (`BRAND_NAME`, `BRAND_LOGO_URL`, `BRAND_COLOR`).

The Portal's shell mounts the console's pages at the same paths (`/admin`, `/manage`, `/access-requests`)
and adds its parts through `ConsoleExtensions` (on an app's page, a *Portal* tab with its usage and
category); the gateway serves the shell or the console at `/`. So Core's links (an access request's
"review" link is `/manage/<id>?tab=requests`) work with or without the Portal. The Portal's own pages
for installing apps and their usage are its built-in app at `/portal` (`portal:apps.manage`).

## Standalone apps (headless mode)

A standalone app runs on its own address with its own page. Sign-in uses OAuth 2.0 authorization code (a
deliberate subset of OpenID Connect, enough for Mosaik's SDKs):

1. The app's backend sends the browser to Core's `/api/auth/oauth/authorize`. Core signs the user in on
   its sign-in page if needed, checks that the return address is under the app's registered address,
   and sends back a one-time code.
2. The backend exchanges the code at `/api/auth/oauth/token`, authenticated by its app key, for a
   short-lived token (the same kind the gateway issues: the user and their grants in this app) and a
   refresh token tied to the user's Core session. Signing out of Core ends it.
3. The backend keeps both in an encrypted cookie on its own domain and turns it into a bearer token on
   each request, as the gateway does for mounted apps, so `AccessControl` and `RequiredPermission` work
   unchanged. The browser never handles tokens.

The SDK does all of this when the app is given its public address (`MOSAIK_PUBLIC_URL`) and Core's
(`MOSAIK_URL`); the same backend code runs mounted or standalone. Signing out of the app ends its refresh
token; signing out of Core ends every app's within a minute (the access token's lifetime). People who are
not signed in get no token, so the app's API answers 401 and its page offers to sign in.
The page links to its own backend for the rest (`standaloneLinks` in `@mosaik/sdk/client`):
`/auth/request-access` and `/auth/notification-settings` take the browser on to Core's pages and back.
`bun dev --headless` runs Core with the console and the standalone apps, without the Portal or the shell.

## The SDK

Apps depend on the SDK's two packages: `@mosaik/sdk`, what every app builds on, with none of Mosaik's UI,
and `@mosaik/web-sdk`, the UI on top of it (components, styles, the page builds, and the shell's frame
through `@mosaik/web-sdk/portal`). Their entry points follow the same two lines as the rest of Mosaik: where
code runs (both sides, server, pages) and which layer it needs (Core, or the Portal through `/portal`). See [Building apps](apps.md#the-sdk) for the list. Behind it,
the internal packages keep the split the monorepo needs; only what the entry points export is public.

Three of those packages hold what pages use, by what they need. `client/solid` needs Solid and no components, so
an app with its own UI can use it. `web-kit` holds Mosaik's components, on `@mosaik/mosaik-ui`. `frame` holds what
surrounds a page (its layout, tabs and header, the command palette, status marks): it is Core's rather than the
Portal's because Core's console hosts pages too, and the console's pages run in both, but only `@mosaik/web-sdk/portal`
offers it to apps, as a standalone app has no frame.

`bun sdk:pack` ships each package's entry points with the internal packages' sources in its tarball, their imports
rewritten to relative paths, so an app sees only what the entry points export. What both build on ships once, in
`@mosaik/sdk`, which exports it under `internal/` to `@mosaik/web-sdk` alone: two copies in an app would each keep
their own state.

## Deliberately left out (for now)

- Standalone apps in the Portal's directory: they are registered with Core but the shell lists only apps
  it can mount.
- A full OpenID Connect provider (ID tokens, userinfo) for clients other than Mosaik's SDKs. AI clients
  sign in with OAuth 2.1 (discovery, PKCE), for the MCP server only.
- An admin page for the assistant (provider, model, budgets per person): it is configured through the
  environment for now. Nor does it run scripts that chain many reads in one step ("code mode").
- Narrower access for AI clients: a client may do everything its person can. Choosing fewer permissions
  per client, or tokens limited to some apps, would come on top of `principal.agent`.
- An in-app inbox for standalone apps: their users get notifications by e-mail and Slack.
- A key per platform service: the services still share `INTERNAL_KEY`.
- A styled login page in the shell: it signs in on Core's page too, so sign-in is built once. It could get one
  back if its look matters more than that.
