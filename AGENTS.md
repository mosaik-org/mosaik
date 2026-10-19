# Agents

Instructions for AI coding agents working on Mosaik. People: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What this is

Mosaik is a platform and SDK for a company's internal apps: one shell, one sign-in, roles and app owners,
notifications, events, search and a directory of apps. Read the [README](README.md) first, then
[Architecture](docs/architecture.md), [Building apps](docs/apps.md) or [Operating Mosaik](docs/operations.md)
for the part you touch, and [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions.

- **Two layers:** **Core** (the primitives: auth, notifications, platform, gateway) and **Portal** (the
  shared product: shell, portal service, built-in apps). Core never depends on the Portal; the Portal
  uses Core only through its contracts and the SDK. Decide which layer a change belongs to first.

- **Vocabulary:** everything is an **app**: *built-in* (`apps/<id>`, part of the Portal) or *installed*
  (its team's repository, added at runtime); *mounted* in the shell or *standalone* (its own address and
  page, Core only). Not "dashboard".
- **Layout:** `shell/` (the Portal's web UI), `console/` (Core's, without the Portal; its pages are in
  `packages/console`, which the shell mounts too), `services/` (Core: gateway, auth, notifications,
  platform; Portal: portal), `apps/` (the Portal's built-in apps), `examples/` (example apps, written like a team's app: they
  import only `@mosaik/sdk`), `packages/` (`packages/sdk` is the one package apps use, re-exporting the
  internal packages; `packages/portal` is the Portal's contract),
  `tooling/`, `infra/`, `docs/`.
- **New features for app teams** are shown in an example when that helps: examples are the code teams
  copy.
- **Stack:** Bun and Effect 4 on the server; Solid, TanStack Router/Query/Table, Ark UI and Panda CSS in
  the browser; Postgres.

## Commands

| Command | |
|---|---|
| `bun check` | lint + boundaries + typecheck + tests: must pass before a change is done |
| `bun run build` | build the shell and the console (also regenerates their `src/routeTree.gen.ts`) |
| `bun dev` | run everything (needs `bun infra:up`); `--headless`: Core and standalone examples only |
| `bun sdk:pack` | pack the SDK, after changing `packages/` that apps use |
| `bun examples:verify` | build the examples against the packed SDK, after changing what `@mosaik/sdk` exports or packs |

## Working rules

- **The dev stack may already be running in the user's terminal.** Check the ports (3000, 4000–4003,
  4100+, 4300+, 5173) before starting one; never stop theirs. Verify through HTTP, the database or a browser
  script, not its logs.
- **Verify before saying done:** `bun check`, plus the build and the running app for what you changed.
  Report failures as they are.
- **Match the surrounding code:** its Effect patterns, naming, comment density and doc comments that say
  why. Keep contracts (`manifest.ts`, `api/`, `@mosaik/core`) isomorphic and respect the boundaries
  `bun lint` checks. Something new for apps is exported from the right `@mosaik/sdk` entry point.
- **Early development (0.0.0):** no backward-compatibility shims. Migrations may be rewritten; say so and
  tell the user to reset their development databases.
- **User-visible behavior changes** come with their documentation (README or `docs/`).

## Commits

Commit only when the user asks. Never use `--no-verify`: if a hook refuses, fix the cause.

**Commit messages are the project's memory: write each one to explain *why*, not *how*.** The diff
already shows what changed line by line. What it cannot show is the reasoning: what was wrong or missing,
why this approach and not another, what it means for users, app teams or admins, and what was left out on
purpose. A reader running `git blame` a year from now has only your message to go on.

The format is Conventional Commits, written per [How to Write a Git Commit Message](https://cbea.ms/git-commit/)
(details and the list of types and scopes in [CONTRIBUTING.md](CONTRIBUTING.md#commit-messages)):

- `type(scope): Subject`: imperative ("Add", "Fix", "Send", not "Added" or "Adds"), capitalized, no
  period, about 50 characters after the prefix and 72 at most. It completes "If applied, this commit
  will …".
- A blank line, then a body wrapped at 72 characters: the situation before, the problem, why this change
  solves it, and consequences worth knowing.
- One logical change per commit. Breaking changes for apps get `!` and a `BREAKING CHANGE:` footer.

The hook checks the form, not the content. This passes it and is still a bad message, because it only
describes the diff:

```
refactor(shell): Move glob to builtinSearch.ts and update imports
```

Explain the reason:

```
fix(shell): Keep glob imports out of .tsx files

Vite's dependency scanner expands import.meta.glob by transpiling the
file with vite-plugin-solid's jsx: "preserve", then parses the result
as plain JavaScript. The JSX left in routes/app.tsx made every scan
fail, so dev served dependencies unbundled and reloaded as it found
them. Collecting the search providers in a .ts module avoids the bug
without overriding the plugin's setting, which exists to keep React's
JSX runtime out of Solid files.
```
