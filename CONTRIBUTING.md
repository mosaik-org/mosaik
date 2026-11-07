# Contributing

How changes get into Mosaik: the checks, the commit convention, versions and migrations.

## Setup

```sh
bun install    # also points git at the hooks in .githooks/
bun infra:up
bun dev
```

## Checks

`main` always passes `bun check`: lint (Biome and the [boundaries](README.md#repository) between parts),
typecheck and tests. Git hooks run them for you:

| Hook | Runs | Takes |
|---|---|---|
| `pre-commit` | Biome on the staged files | a second or two |
| `commit-msg` | the commit message convention (below) | instantly |
| `pre-push` | `bun check` | about a minute |

If a hook refuses, fix the cause. `--no-verify` is for emergencies, not for getting around a failing check.

Before you call a change done, also run what it touches: `bun run build` for the shell and the console, `bun dev` and the
pages involved for behavior, `bun examples:verify` for the SDK (it packs it too).

## Commit messages

A diff shows *what* changed. Only the message can say **why**: what was wrong or missing before, why this is
the fix, and what it means for the people and apps using Mosaik. Months from now, `git log` and
`git blame` are how someone (often you) will understand a decision, so write for that reader.

We use [Conventional Commits](https://www.conventionalcommits.org/), written the way
[How to Write a Git Commit Message](https://cbea.ms/git-commit/) describes:

```
type(scope): Imperative, capitalized summary without a period

Body wrapped at 72 characters. What was the situation before, and what
was wrong with it? What does this change do about it, and why this way
rather than another? Mention side effects, follow-ups and anything a
reviewer would otherwise have to guess.

Refs: https://example.com/related-discussion
```

- **Subject:** about 50 characters after the prefix, 72 at most. Imperative mood: it completes
  "If applied, this commit will …". Capitalized, no period.
- **Blank line** between subject and body.
- **Body:** explain what and why, not how; the code shows how. Wrap at 72. A one-line commit is fine
  when the subject says it all (a typo, a version bump).
- **One logical change per commit.** If the subject needs "and", it is probably two commits. Generated
  files (`shell/src/routeTree.gen.ts`, `bun.lock`) go in the same commit as their source.

**Types:**

| Type | For |
|---|---|
| `feat` | something new for users, app teams or admins |
| `fix` | a bug fix |
| `refactor` | a code change that neither fixes a bug nor adds a feature |
| `perf` | faster or lighter, same behavior |
| `docs` | documentation only |
| `test` | tests only |
| `build` | dependencies, bundling, Docker image, scripts that build |
| `ci` | continuous integration |
| `chore` | anything else that changes no behavior (tooling, cleanup) |
| `revert` | undoing an earlier commit |

**Scopes** name the part changed: Core's `gateway`, `auth`, `notifications`, `platform`, `console`; the
Portal's `portal` and `shell`; `sdk` (the `packages/` apps build on), `ui`, `db`, `apps/<id>` (a built-in app),
`examples/<id>`, `tooling`, `infra`, `docs`. Leave the scope out when a change spans many parts.

**Breaking changes** for apps get a `!` (`feat(sdk)!: …`) and a `BREAKING CHANGE:` footer saying what apps
must change. That covers the manifest, the platform API, what `@mosaik/sdk` and `@mosaik/web-sdk` export and the shared modules: apps are
rebuilt against them.

The hook checks the form; only you can supply the reason. This passes the hook and still says nothing
the diff doesn't:

```
fix: Update AccessRequests.ts
```

One that tells the next reader why:

```
fix(platform): Send access requests to app owners, not every admin

With hundreds of apps, admins can't judge who should use each one,
and every request pinged all of them. Owners decide who can use their
app, so their requests now go to them; apps without an owner still
go to the admins, so no request is lost.
```

## Branches

Work on `main` for now; the repository is local. Once there is a remote, use short-lived branches per
change and keep `main` passing.

## Versions

Everything is `0.0.0` while Mosaik is in early development, and anything may change: apps are rebuilt
along with the platform. From the first release on, `PLATFORM_VERSION` follows semantic versioning, the SDK
(`@mosaik/sdk`, `@mosaik/web-sdk`) shares it, and a breaking change for apps means a new major version (apps declare the major they
were built for, and the platform refuses others).

Besides the SDK's API, apps depend on two things at runtime that a change can break without a type error:
- **the shared modules** (`SHARED_MODULES` in `@mosaik/portal/build/shared`): their versions come from the shell;
- **the theme's token names**: an app's own styles read the page's variables (`--mk-colors-fg-muted`).
  `packages/styled-system/token-names.txt` records them. Its test fails when one disappears, which
  makes removing or renaming a token a breaking change. After adding tokens, run the tests with `-u`
  to record them.

## Database migrations

Until the first real deployment, migrations may be rewritten, squashed or replaced: say so in the commit
body, and reset your development databases (`docker compose -f infra/compose.dev.yml down -v && bun infra:up`).
After that, an applied migration never changes; every change is a new migration.

## Documentation

Behavior that users, app teams or admins see is documented with the change: the [README](README.md),
[Architecture](docs/architecture.md), [Building apps](docs/apps.md) or [Operating Mosaik](docs/operations.md).
