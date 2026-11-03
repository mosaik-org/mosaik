# Operating Mosaik

- [Deployment](#deployment)
- [Sign-in and Core's pages](#sign-in-and-cores-pages)
- [Standalone apps](#standalone-apps)
- [Installing apps](#installing-apps)
- [Running app images](#running-app-images)
- [Access: roles, owners and requests](#access-roles-owners-and-requests)
- [Finding apps](#finding-apps)
- [Notifications and channels](#notifications-and-channels)
- [AI clients (MCP)](#ai-clients-mcp)
- [The assistant](#the-assistant)

## Deployment

```sh
cp .env.example .env   # fill in secrets and PUBLIC_URL
docker compose -f infra/compose.yml --env-file .env up -d --build
```

The image runs every service and built-in app (the examples are not deployed). Only the gateway is published (`HTTP_PORT`, default 8080),
and it also serves the shell. For Entra ID, register the redirect URI
`<PUBLIC_URL>/api/auth/callback/microsoft`. `.env.example` documents every setting.

- **Core and the Portal.** Core is the `auth`, `notifications`, `platform`, `mcp`, `assistant` and `gateway` services and its
  console; the Portal is the `portal` service and the shell. The gateway serves one of the two UIs at `/`
  (`STATIC_DIR`): the shell (`/app/shell/dist`), or without the Portal the console
  (`/app/console/dist`), then also leave out the `portal` service and `UPSTREAM_PORTAL`.
- **Configured apps** are listed in `CONFIGURED_APPS` (`id=url,…`, platform service): built-in apps with a
  backend, and standalone apps. Their keys are derived from `INTERNAL_KEY` (an app outside the image gets
  its key as `MOSAIK_APP_KEY`). They follow the list: an app removed from it loses its identity (its
  permissions and roles stay, marked stale, until it comes back). `bun dev` lists the examples there.
- **Databases.** Each service and built-in app has its own Postgres database, `mosaik_<id>`, created by the
  Compose `provision` job (`bun db:provision`). Passwords are derived from `DB_PASSWORD_SECRET`. The
  platform provisions databases for apps the Portal runs (`POSTGRES_URL`, `APP_DB_SERVER_URL`).
- **Files.** Apps that declare `storage` keep files with the platform service, which stores them in an S3
  service: SeaweedFS (`seaweedfs` in compose), reached at `STORAGE_URL` with `STORAGE_ACCESS_KEY_ID` and
  `STORAGE_SECRET_ACCESS_KEY` (the same values configure SeaweedFS), in the bucket `STORAGE_BUCKET`
  (`mosaik`), a folder per app. Any S3-compatible service works in its place. Without `STORAGE_URL`, apps
  cannot store files.
  - **Limits.** Each app may store `STORAGE_DEFAULT_LIMIT_GB` (5) unless an admin gives it a limit of its
    own on its management page (Storage tab, audited); owners see their app's usage there. Files beyond the
    limit are refused as they arrive. Per-file limits are each app's own.
  - **Uploads** reach apps through the gateway: each request is limited to 128 MB (Bun's default) by the
    gateway and the app, unless raised (`maxRequestBodySize` in `runApp` and `serve`).
  - **Backups.** File contents are in the `files` volume, their sizes and types in the platform's database:
    back up both together. Removing an app deletes its files.
- **Signing keys.** The auth service creates the token signing keys on first start and publishes them at
  `/.well-known/jwks.json`; apps verify tokens against the platform's copy (`/api/platform/v1/jwks.json`).
- **Observability.** Set `OTEL_EXPORTER_OTLP_ENDPOINT` to export traces, logs and metrics over OTLP.

## Sign-in and Core's pages

- **One sign-in.** Everything signs in on Core's page, `/api/auth/sign-in`: the shell, the console and
  standalone apps. It offers e-mail and password, and *Sign in with Microsoft* when Entra ID is set up.
- **Branding.** Core's pages (sign-in, requesting access, notification settings) show `BRAND_NAME`
  (default `Mosaik`), `BRAND_LOGO_URL` (a square image; without it, the name's first letter) and
  `BRAND_COLOR` (default `#2563eb`).
- **The console** (`/admin`, `/manage`, `/access-requests`) is for admins (`admin:access`) and app owners,
  for the apps they own. With the Portal, the shell shows the same pages.
- **For everyone:** *request access* (`/api/platform/request-access/<app>`, where standalone apps send
  people) and *notification settings* (`/api/notifications/preferences`, linked from every notification
  e-mail).

## Standalone apps

A standalone app runs on its own address with its own page and uses Core without the Portal (see
[Architecture](architecture.md#standalone-apps-headless-mode)). To run one:

1. Add it to `CONFIGURED_APPS` (`notes=https://notes.example.com`), and give it the key derived for it
   (`MOSAIK_APP_KEY`), or `INTERNAL_KEY` if it runs inside your network.
2. Set `PLATFORM_URL` (the platform API), `MOSAIK_URL` (Core's public address, `PUBLIC_URL`) and
   `MOSAIK_PUBLIC_URL` (the app's own public address). It registers that address with Core, and sign-in
   returns only to addresses under it.

People sign in on Core's page, and the app links to Core's pages for asking for access and for
notification settings. Admins and the app's owners manage it in the console (`/manage/<id>`), as any other
app.

## Installing apps

Installed apps are added at runtime, with no platform release, from the Portal's **Apps** page (`/portal/apps`)
(`portal:apps.manage`, the Portal's *App operator* role):

| | Hosted elsewhere | Docker image |
|---|---|---|
| Install by | its base URL (manifest at `/.well-known/mosaik-app.json`) | image reference; the Portal pulls it (pinned by digest), or uses the image on this host when it can't be pulled |
| Runs | wherever its team runs it | as a container on this host (Docker API) |
| Key (`MOSAIK_APP_KEY`) | shown once at install | injected by the Portal |
| Database | its own | the platform's (`mosaik_<id>`) or its own `DATABASE_URL` |
| Settings | its own | declared in the manifest, entered at install (secrets encrypted) |
| Updates | its team deploys; *Read manifest again* | *Update…* (rolled back automatically if not healthy), *Roll back*, logs |

- **Before installing,** the Portal reads the app's manifest and shows its permissions, roles,
  notifications, events and settings. Apps built for another platform major version are refused, and so
  are ids Core already knows.
- **Configured apps** are listed too, marked *Configured*: they can be disabled and enabled here, and
  otherwise follow `CONFIGURED_APPS`.
- **Owners.** A new app has no owners, so its access requests go to admins until someone gets its *Owner*
  role (on the app's page, *People*).
- **Health.** The Portal checks every app's `/health` every 15 seconds, restarts missing containers and
  follows changed ports.
- **Events.** Per app, admins see how many events are waiting, the last error and when it last asked, and
  can skip an event the app keeps failing on (only that one).
- **Uninstalling** removes the app's roles (and who had them), its usage, pins and requests, and can delete
  its database.

## Running app images

- **Docker access.** The Portal needs the Docker socket (`DOCKER_SOCKET`). In compose it is mounted into
  the portal container only, which gets the socket's group (`DOCKER_GID`). This is root-equivalent access
  to the host: install only trusted apps.
- **Networking.** Containers join the `mosaik-apps` network (`DOCKER_NETWORK`).
  - `APP_ADDRESSING=network` (compose): the Portal and the gateway reach them by container name, and they
    reach the platform API at `APP_PLATFORM_URL`.
  - `APP_ADDRESSING=host` (`bun dev`, or the Portal on the host): ports are published on 127.0.0.1 only.
- **Databases.** The platform (Core) provisions an app's database with `POSTGRES_URL` (superuser) when the
  Portal asks, and the container gets only its own `DATABASE_URL`, built for `APP_DB_SERVER_URL`.
- **Registries.** Private registries' credentials are stored on the Portal's Apps page (encrypted).
- **Encryption key.** Configuration values, keys and registry passwords are encrypted with a key derived from
  `INTERNAL_KEY`: rotating it means entering them again.

## Access: roles, owners and requests

- **Roles.** Each app declares its roles (see [Building apps](apps.md#permissions-roles-and-owners)), and so
  do Core's administration (*Auditor*, *User admin*, *Notifications operator*) and the Portal (*App
  operator*). Admins
  with `admin:roles.manage` can also create their own roles for any mix of permissions, under
  **Administration → Roles & permissions**, where app roles are listed per app (read-only).
- **Users.** **Administration → Users** (`admin:users.manage`) creates users (SSO users are created on their
  first sign-in), gives roles and deletes users.
- **App owners.** Holders of an app's *Owner* role (or of a role granting `<app>:access.manage`) decide who
  can use it, on its page in the console (`/manage/<id>`; in the shell, *Manage apps* or *Manage* on the
  app's directory page):
  - *Roles*: what each of the app's roles allows, and its owners.
  - *People*: who has which of the app's roles, and who reaches it through another role; add someone or
    change their roles. Their other roles stay as they are.
  - *Requests*: approve with one of the app's roles, or decline with a reason.
  - *Portal* (in the shell): its use over the last 30 days, and where All apps lists it.

  Admins with `admin:users.manage` can do the same for every app, standalone ones included.
- **Access requests.** Someone who can't open an app asks for one of its roles from All apps or the app's
  page in the shell, or on Core's request page (standalone apps link to it). Its owners are notified, or the admins when it has none; superadmins aren't notified about apps
  that have owners. *Access requests* in the sidebar lists the requests waiting for the apps someone
  manages. The person is notified of the answer, and a request also closes by itself once they get access
  some other way.
- **Changes apply at once.** Database triggers signal every change to someone's roles, a role's grants or
  an ended session. The gateway drops the affected tokens, and open browsers reload the session (their tabs
  share one live connection), so apps appear and disappear without a reload.
- **Audit.** Every change to users, roles, app members, requests and installs is in **Administration →
  Audit log** (`admin:audit.view`).

## Finding apps

Built so that hundreds of apps stay manageable whether someone uses three or thirty:

- **Sidebar.** The user's pinned apps (in their order, kept by the Portal so they follow the user across
  devices), then all their other apps when they can open 8 or fewer, or else the 5 they used most recently.
  The open app's pages are listed under it (from its manifest), and owners and admins get a *Manage*
  section: *Access requests*, with a count of those waiting, and *Manage apps*.
- **Collapsing the sidebar.** Ctrl/⌘+B, the button at its foot or the command palette collapses it to a
  rail of icons, remembered in that browser. Narrower screens (below 1024 px) get the rail whatever was
  chosen; resting the pointer on it, or moving focus into it, opens it over the page. Going to another
  page never changes it.
- **All apps** (`/directory`). Every app by category, with search, *Most used* sorting and pinning. Apps the
  user can't open are listed too, with *Request access*. Apps declare a category; owners and admins can
  list an app under another one.
- **App pages** (`/directory/<id>`). An app's roles and what each allows, who can use it and its owners;
  *Manage* for the people who decide about it.
- **Overview.** Pinned and recently used apps, unread notifications, and the pages the user visited last
  (kept in the browser).
- **Usage.** The shell reports each time someone goes into an app. It drives the recent list and the palette
  ranking; the Portal's **Usage** page (`/portal/usage`) shows per app how many people used it in the last 30 days, ever, and
  when it was last opened.

## Notifications and channels

- **E-mail:** `SMTP_URL` (`smtp://user:pass@host:587` or `smtps://…:465`) and `MAIL_FROM`. Without them,
  e-mail is rejected. `MAIL_ALLOWED_DOMAINS` limits which addresses apps may write to (empty: none, `*`: any,
  or a list such as `example.com,*.partner.com`). In development, mail goes to Mailpit.
- **Slack (optional):** `SLACK_BOT_TOKEN`, a bot token with `chat:write` and `users:read.email`. It enables
  Slack channel targets and personal Slack notifications (to the workspace member with the user's e-mail).
  Webhook targets work without it.
- **Teams:** needs no configuration; it is used through channel targets (personal Teams messages are not
  supported).
- **Limits.** Each app may queue `MESSAGES_PER_MINUTE` deliveries per minute (default 120); failed deliveries
  are retried up to `DELIVERY_MAX_ATTEMPTS` times (default 8).

In **Administration → Notifications** (`admin:notifications.view` / `admin:notifications.manage`), admins add
channels (a Teams workflow webhook, a Slack incoming webhook, or a Slack channel the Mosaik app posts to),
send a test message to each, and route notification types and message kinds (`<app>:<name>`) to channels in
addition to their recipients. **Administration → Deliveries** is the delivery log, with a retry for failed
deliveries. Webhook URLs are never shown again after they are saved.

## AI clients (MCP)

People can use apps from their AI client (any client of the Model Context Protocol)
through Mosaik's MCP server, the `mcp` service. It is on whenever Core runs; it offers only what apps
offer (`AgentTool`, see [Building apps](apps.md#ai-clients)).

- **The address** to add to a client is `<PUBLIC_URL>/mcp`. People find it on their *AI clients* page
  (`/api/auth/agents/connections`, in the shell's account menu and the console's header).
- **Signing in.** The client finds Core's sign-in through standard OAuth metadata
  (`/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`, served through
  the gateway). Clients identify themselves either by the address of a metadata document their vendor
  publishes (the consent page shows its domain) or by registering on the spot (the consent page says
  the name is unverified). The person signs in to Core if needed and allows the client once.
- **What a client may do.** Everything its person can do, in every app that offers tools, with the
  person's current permissions: each call gets a fresh token, so role changes apply at once.
- **How long.** A connection lasts as long as the Core session it was allowed in: signing out of Core
  disconnects the person's AI clients too. People disconnect a client on their *AI clients* page; admins
  see and disconnect everyone's under Administration → *AI clients* (`users.manage`, audited).
- **Audit.** What a client does is recorded as its person's, with the client's name ("via <the client's name>").
- **Limits.** Each connection may make `TOOL_CALLS_PER_MINUTE` calls a minute (120). Answers are cut
  at 60,000 characters.
- **Network.** The `mcp` service calls apps' backends directly, like the gateway, so it needs the same
  networks (`apps`, for image apps). The auth service fetches clients' metadata documents over HTTPS
  (outbound access to the internet, 5 KB at most, never following redirects).

## The assistant

The assistant is a chat in the shell with an AI that uses apps' tools as the person, the same tools
AI clients get through the MCP server. It opens beside any page (the sparkles button, or Ctrl/⌘+J),
where it knows which page the person is on, and on a page of its own (`/assistant`, "Assistant" in the
sidebar) for longer conversations, with the person's conversations listed; a conversation moves
between the two. It is off until an admin
chooses a model: it sends people's questions, and what apps answer them, to that model's provider.

- **The model**, in the `assistant` service's environment: `ASSISTANT_PROVIDER` and `ASSISTANT_MODEL`,
  with the provider's credentials.
  - `opencode`: OpenCode Zen, pay as you go, any of its text models (`OPENCODE_API_KEY`; `OPENCODE_BASE_URL`
    defaults to its OpenAI-compatible endpoint).
  - `opencode-go`: OpenCode Go, a subscription, with the same key. The assistant identifies itself
    (`mosaik-assistant/1.0`) and names each conversation (`x-opencode-session`), as Go asks of clients.
    OpenCode designed Go for coding agents and monitors its traffic, so check its terms fit your use.
  - `anthropic`: the Anthropic API (`ANTHROPIC_API_KEY`).
  - `bedrock`: Amazon Bedrock, any model with tool use (`AWS_REGION` and the usual AWS credentials).
- **Changes need the person's approval.** Tools that only read run at once; every call that changes
  something waits for the person to allow or deny it in the panel. Writing again denies the calls still
  waiting.
- **Links and navigation.** The assistant finds pages and records as the command palette (Ctrl/⌘+K)
  does, and links to them; asked to go somewhere, it opens the page, with the conversation beside it.
  These run in the person's browser, so they find only what that person can see.
- **As the person.** Calls run with the person's current permissions, and the audit log records them as
  the person's, "via <BRAND_NAME> assistant".
- **History.** Conversations are kept, each visible only to its person, in the assistant's database
  (`mosaik_assistant`). After its first answer, the model names a conversation in a few words (one more
  short request to the provider); people can rename or delete their conversations, and search them by
  title. Deleting a conversation leaves what the assistant changed in apps as it is.
- **Suggestions.** A new conversation offers questions to start with, from the examples of the tools
  the person may use (`examples` in an app's `AgentTool`), a few from each app.
- **Limits.** A turn takes at most 20 model steps since the person last wrote; each person may make `TOOL_CALLS_PER_MINUTE` tool calls
  a minute (120); answers from apps are cut at 60,000 characters.

