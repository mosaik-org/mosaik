---
name: convert-to-mosaik
description: Converts an existing app, dashboard or internal tool into a Mosaik app by understanding what it does and rebuilding it on the Mosaik SDK, never by translating its code line by line. Use this skill whenever someone wants to move, migrate, port, rewrite, bring over or "make Mosaik-compatible" an existing application: a React, Vue, Angular, Svelte or plain-HTML front end, a Django, Rails, Express, Flask, Spring or PHP back end, a Retool, Appsmith, Streamlit, Grafana, Metabase or Power BI dashboard, an admin panel, a spreadsheet-driven tool, or a script with a UI, even if they only say "add this to the portal", "can we host this in Mosaik" or point at a repository and ask what it would take.
---

# Converting an app to Mosaik

Mosaik gives every internal app one sign-in, roles and owners, notifications, settings, file storage, an
audit log and a shared shell. Converting an app means rebuilding what it *does* on those primitives, so
that the result looks and behaves like a Mosaik app and is as easy to maintain as one written for Mosaik
from the start.

## Before anything else: the model

This work is analysis and design more than typing: reading an unfamiliar codebase, working out what it
really does, and redesigning it for a different platform. Smaller models tend to fall back on translating
code line by line, which is exactly what this skill exists to prevent.

Check which model you are running as (your system prompt says). Unless it is its provider's most
capable current model (the largest tier, not a smaller, faster or older one), stop before starting and
tell the user, in a sentence or two, that conversions should run on the most capable model available and
why; ask them to switch models in their agent and start again. If they choose to continue anyway, that is
their decision: go ahead, and mention the risk once in your final report.

## The principle: rebuild, don't translate

Do not port the original code file by file, function by function or component by component. Read it to
learn what the app does, for whom, with which data and rules; then design the Mosaik app from that
understanding and write it from scratch.

Why this matters:

- **The original solves problems Mosaik already solves.** Its login, sessions, user tables, role checks,
  e-mail sending, file handling, theming and layout are replaced by the platform. Translated, they come
  along as dead weight or, worse, as a second security model next to Mosaik's.
- **Its structure fits its old framework, not this one.** Mosaik apps are built around a typed API
  contract (`api/`) shared by the backend and the pages, Effect services on the server, and TanStack Query
  with Solid in the browser. Code shaped for Redux, Django views or a Retool query panel does not become
  good Mosaik code by changing its syntax.
- **Apps accumulate things nobody uses.** A rebuild is the cheapest moment to leave them out, provided the
  user agrees (see step 2).
- **Behavior is what people rely on, not code.** Keeping the behavior (the same numbers, the same rules,
  the same permissions) is the goal; keeping the code is not.

Reusing a well-tested pure function (a pricing formula, a parser) is fine when it is genuinely independent
of the old framework; say so in the plan. Everything else is rewritten.

## The workflow

Work in this order. Each step ends with something the user can check, because a misunderstanding caught in
step 2 costs minutes and one caught in step 7 costs the rebuild.

### 1. Learn Mosaik first

In the Mosaik repository, read `AGENTS.md`, `README.md`, `docs/apps.md` (building apps: the manifest, the
backend's services, pages, settings, files, testing, standalone apps) and the parts of
`docs/architecture.md` you need. Then study `examples/sales`, the reference app: its `manifest.ts`,
`api/`, `server/` (handlers, `Orders` and its in-memory stand-in, tests) and `web/`. New code should look
like Sales'.

### 2. Understand the original

Read the original app as an analyst, not a translator. Build an inventory of what it does:

- **People and access:** who uses it, which groups see or do what, who administers it.
- **Screens and what each one is for:** what people look at, filter, change, export; which views are
  dashboards and which are work queues.
- **Actions and rules:** every operation that changes data, its validation and business rules, its side
  effects (e-mails, messages, records in other systems).
- **Data:** what it stores (tables, files), where it reads from (its database, external APIs, spreadsheets),
  how fresh the data must be, and how much there is.
- **Configuration:** addresses and credentials, versus values admins change (limits, texts, switches).
- **Things that run on their own:** cron jobs, queues, webhooks, live updates.
- **Integrations:** other systems it calls or that call it.

Run the original if you can, and read its tests: they show intended behavior better than the code does.
Then ask the user what the code cannot tell you: which features are used, which are not, what annoys people,
what must stay identical (reports others depend on, numbers finance checks).

Write the inventory down as a short document and confirm it with the user before designing.

### 3. Map it onto Mosaik

Most of the original's infrastructure has a Mosaik counterpart. Use it rather than rebuilding it:

| The original has | In Mosaik |
|---|---|
| Login, sessions, password reset, SSO | Nothing to build: the platform signs people in (`CurrentPrincipal` on the server, `usePrincipal` in pages) |
| Users table, user profiles | Mosaik's users (`UserId`); keep only app data keyed by user id; handle `user.deleted` (platform events) |
| Roles, ACLs, `isAdmin` flags | Permissions and roles in `manifest.ts`, `RequiredPermission` on endpoints, owners who give roles |
| Checks only in the UI | Checks on the server (`RequiredPermission`); the UI only hides what the server refuses |
| Admin-editable limits, texts, feature switches | `settings` in the manifest, read live with `Settings.for(app)` |
| Environment variables: URLs, tokens | `portal.config` (label and kind), set when the app is installed |
| Uploads, files on disk or in S3 | `storage: true` and `Storage`, served with `storage.respond` |
| E-mail, Slack or Teams sending | `Notify` (people, by permission or user) and `Messages` (e-mail, channels) |
| Activity or history logs | `Audit` (the central audit log) |
| Its own database | `database: true` with migrations, read through an Effect service |
| WebSockets, polling for updates | `Live.eventStream` and `createEventStream` |
| Charts | `@mosaik/web-sdk/charts` (themed, follows dark mode) |
| Data tables with paging, sorting, filters | `DataTable` (`@mosaik/web-sdk/table`), server-side for large data, state in the URL (`useTableSearch`) |
| Forms | `createForm` with the API payload's Schema, `useAction` for calls |
| Component libraries (MUI, Ant, Bootstrap, Tailwind UI) | `@mosaik/mosaik-ui` components and the theme's tokens (`css`, `token.var`) |
| Global stores (Redux, Vuex, Pinia) for server data | TanStack Query through `createApi(Api)`: the server is the store |
| A navigation bar | the manifest's `portal.pages` (the shell's sidebar lists them) and `AppLayout`; full-width pages with `staticData: { layout: "wide" }` |
| Search box across records | `defineSearchProvider` in `web/search.ts` (the command palette) |
| Calls to Jira and similar | A connector (`@mosaik/sdk/connectors/*`) or an Effect service of the app's own |

Not available yet, so raise them with the user instead of inventing a substitute: **scheduled jobs and
background queues**, **per-person preferences kept by the platform**, **approvals** and **calling another
Mosaik app's API**. Ideas for these exist; until they are built, agree on the simplest interim solution
(often: the app's own table, or leaving the feature for later).

### 4. Decide what kind of app it becomes

- **Installed** (its team's own repository; `bun create:app <id> --dir ../<id> [--db]`): the default for a
  team's app. It runs hosted elsewhere or as an image the Portal runs.
- **Built-in** (`bun create:app <id> --builtin [--db]`, in `apps/<id>`): only for apps that ship with the
  platform itself.
- **Mounted** in the shell (the default) or **standalone** on its own address (for apps that need their own
  page, or must work with Core alone): see "Standalone apps" in `docs/apps.md`.

### 5. Design before writing code

Write the design down and confirm it with the user:

- **The manifest:** id, permissions (named for what they allow: `orders.refund`, not `admin`), roles,
  notifications, settings, `database` and `storage`.
- **The API contract** (`api/`), the center of the app: endpoints, payload and response Schemas, errors,
  the permission each needs. Pages and backend both follow from it.
- **The data model and migrations**, and what in the old data maps where.
- **The pages:** for each, what it shows and which endpoints it calls; which are `wide`.
- **What changes** for users compared with the original, and **what is left out**, with the user's
  agreement.

### 6. Build it

Scaffold with `bun create:app`, then write the contract first, the backend's services and handlers next
(rules in the handlers, data access in services, as in Sales), and the pages last. Follow the surrounding
code's patterns: Effect services with layers, `Schema` for every boundary, doc comments that say why.
Apps import only `@mosaik/sdk` and `@mosaik/mosaik-ui`.

If the original has data people still need, write a one-off migration script that reads the old store and
writes through the new app's own data layer, run it separately from the app, and check counts and totals
afterwards. It is not part of the app's runtime.

### 7. Verify

- **Tests** with `@mosaik/sdk/testing`: call the API as people with and without each permission, check
  the rules (limits, validation, state changes) and what is audited and notified. Replace the app's own
  services with in-memory stand-ins, as `examples/sales/server/Orders.memory.ts` does.
- **`bun check`** in the Mosaik repository (or the app's `typecheck`, `test` and `build` in its own).
- **In the running platform** (`bun dev`): open every screen, perform every action, as people with
  different roles. Compare the results with the original's: the same data should give the same numbers.

### 8. Report

Finish with a parity table built from the inventory of step 2:

| What the original did | In Mosaik | Status |
|---|---|---|
| Refunds by managers, up to €500 | `orders.refund` permission, `refundLimit` setting | Done |
| Nightly e-mail of new orders | Not available yet (no scheduled jobs) | Left out, agreed |

Then list what behaves differently, what was left out and why, the data migration's results, and the
follow-ups (including features waiting for Mosaik primitives that do not exist yet).

## Mistakes to avoid

- Porting the original's login, user table or role checks: the platform does this, and a second system
  diverges from it.
- Keeping permission checks only in the pages.
- Copying the old component library, CSS or layout; the app should look like the rest of Mosaik.
- Fetching with hand-written `fetch` calls instead of `createApi` and `useAction` on the contract.
- Storing files on the server's disk (lost on every upgrade of an image app) instead of in `Storage`.
- Putting values admins change into environment variables, or secrets into settings.
- Carrying over features nobody uses without asking, or dropping features without asking.
- Declaring the conversion done without comparing it with the original, screen by screen.
