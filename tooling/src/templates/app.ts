/**
 * An app in its own repository: backend + browser bundle + Dockerfile, built on the SDK
 * tarball. It runs hosted elsewhere or as an image the Portal runs.
 */
export interface AppTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly database: boolean
  /** `package.json` dependency specifiers: the SDK's packages as `file:` tarballs, the rest as versions. */
  readonly dependencies: Record<string, string>
  readonly devDependencies: Record<string, string>
  readonly platformVersion: string
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export const appFiles = (t: AppTemplate): Record<string, string> => ({
  "package.json": json({
    name: t.id,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "bun scripts/dev.ts",
      // \`--bun\`: Vite loads the SDK's TypeScript sources with Bun (Node cannot).
      build: "panda codegen --silent && bun --bun vite build && bun scripts/manifest.ts",
      start: "bun server/main.ts",
      typecheck: "tsc --noEmit",
      test: "vitest run --passWithNoTests",
      image: `bun run build && docker build -t ${t.id}:latest .`,
    },
    dependencies: t.dependencies,
    devDependencies: t.devDependencies,
  }),

  "tsconfig.json": json({
    compilerOptions: {
      target: "ES2023",
      lib: ["ES2023", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      moduleDetection: "force",
      jsx: "preserve",
      jsxImportSource: "solid-js",
      resolveJsonModule: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["bun", "vite/client"],
    },
    include: [
      "manifest.ts",
      "api",
      "server",
      "web",
      "scripts",
      "vite.config.ts",
      "vitest.config.ts",
      "panda.config.ts",
    ],
  }),

  ".gitignore": "node_modules\ndist\nmosaik-app.json\n.env\nstyled-system\n",

  ".dockerignore": "node_modules\ndist\n.env\n.git\n",

  ".env.example": `# Where the platform API is (the platform's public URL when hosted elsewhere).
PLATFORM_URL=http://localhost:3000
# Issued when the app is installed (Portal → Apps → Install app → Hosted elsewhere).
MOSAIK_APP_KEY=
PORT=4300
${t.database ? `# Your database (the platform provides one when it runs the image).\nDATABASE_URL=postgres://postgres:postgres@localhost:5432/${t.id.replaceAll("-", "_")}\n` : ""}GREETING=Hello
`,

  "manifest.ts": `import { defineApp } from "@mosaik/sdk"

/** What Mosaik knows about the app: identity, permissions, notifications, events, and how the Portal lists it. */
export const app = defineApp({
  id: "${t.id}",
  name: "${t.name}",
  version: "0.0.0",
  description: "${t.description}",
  access: "view",
  permissions: {
    view: { description: "Use ${t.name}", defaultRoles: ["authenticated"] },
  },
  // What admins and the app's owners give people, smallest first (each includes \`access\`).
  // Without roles the app gets a \`member\` role; every app also gets an \`owner\` role.
  // roles: { viewer: { name: "Viewer" }, editor: { name: "Editor", grants: ["items.*"] } },
  // (grants name the app's own permissions: declare \`items.edit\` etc. above first)
  notifications: {
    hello: { description: "Greetings from ${t.name}" },
  },
  /** Platform events the app receives: handled in \`server/events.ts\`. */
  events: ["user.deleted"],
  database: ${t.database},
  /** How the Portal lists the app, and the settings admins enter when it runs the image. */
  portal: {
    icon: "${t.icon}",
    category: "Other",
    config: {
      GREETING: { description: "How the app greets people", required: false },
    },
  },
})

export default app
`,

  "api/index.ts": `import { AccessControl } from "@mosaik/sdk"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { app } from "../manifest"

export class Hello extends Schema.Class<Hello>("${t.id}/Hello")({
  message: Schema.String,
  version: Schema.String,
${t.database ? "  /** Greetings served so far (stored in the app's database). */\n  count: Schema.Number,\n" : ""}}) {}

export class HelloGroup extends HttpApiGroup.make("hello").add(
  HttpApiEndpoint.get("get", "/hello", { success: Hello }),
  /** Sends the caller a notification (in-app, or wherever they chose). */
  HttpApiEndpoint.post("notify", "/hello/notify", { success: HttpApiSchema.NoContent }),
) {}

export class Api extends HttpApi.make("${t.id}").add(HelloGroup).prefix(app.apiPrefix).middleware(AccessControl) {}
`,

  "server/main.ts": [
    'import { CurrentPrincipal } from "@mosaik/sdk"',
    `import { Audiences, ${t.database ? "Database, " : ""}Notify, runApp } from "@mosaik/sdk/server"`,
    `import { Config, Effect${t.database ? ", Layer" : ""} } from "effect"`,
    'import { HttpApiBuilder } from "effect/http-api"',
    ...(t.database ? ['import { SqlClient } from "effect/sql"'] : []),
    'import { Api, Hello } from "../api"',
    'import { app } from "../manifest"',
    'import { EventHandlers } from "./events"',
    ...(t.database ? ['import { migrations } from "./migrations"'] : []),
    `
const HelloHandlers = HttpApiBuilder.group(
  Api,
  "hello",
  Effect.fn(function* (handlers) {
    const greeting = yield* Config.String("GREETING").pipe(Config.withDefault("Hello"))
    const notify = yield* Notify${t.database ? "\n    const sql = yield* SqlClient.SqlClient" : ""}

    return handlers.handleAll({
      get: Effect.fn(function* () {
        const principal = yield* CurrentPrincipal${
          t.database
            ? `
        const [row] = yield* sql<{ count: number }>\`UPDATE greetings SET count = count + 1 RETURNING count\`.pipe(
          Effect.orDie,
        )`
            : ""
        }
        return new Hello({
          message: \`\${greeting}, \${principal.user?.name ?? "visitor"}!\`,
          version: app.version ?? "",${t.database ? "\n          count: row?.count ?? 0," : ""}
        })
      }),
      notify: Effect.fn(function* () {
        const principal = yield* CurrentPrincipal
        if (principal.user === null) return
        yield* notify
          .send({
            type: app.notification("hello"),
            audience: Audiences.users(principal.user.id),
            content: { title: \`\${greeting} from ${t.name}\`, link: "/${t.id}", severity: "success" },
          })
          .pipe(Effect.orDie)
      }),
    })
  }),
)

runApp({
  app,
  api: Api,
  handlers: ${t.database ? "HelloHandlers.pipe(Layer.provide(Database.layer({ serviceId: app.id, migrations })))" : "HelloHandlers"},
  events: EventHandlers,
})
`,
  ].join("\n"),

  "server/events.ts": `import { Events } from "@mosaik/sdk/server"
import { Effect } from "effect"
import { app } from "../manifest"

/**
 * Handlers of the platform events the app subscribes to in its manifest. Events arrive in
 * order, at least once: a handler may see the same event again (\`event.id\` tells).
 */
export const EventHandlers = Events.handlers(
  app,
  Effect.succeed({
    "user.deleted": ({ userId }) => Effect.logInfo(\`User \${userId} was deleted\`),
  }),
)
`,

  ...(t.database
    ? {
        "server/migrations/index.ts": `import type { Migrations } from "@mosaik/sdk/server"
import greetings from "./0001_greetings"

export const migrations: Migrations = {
  "0001_greetings": greetings,
}
`,
        "server/migrations/0001_greetings.ts": `import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql\`CREATE TABLE greetings (count integer NOT NULL)\`
  yield* sql\`INSERT INTO greetings (count) VALUES (0)\`
})
`,
      }
    : {}),

  "web/index.tsx": `import { AppLayout, defineWebApp } from "@mosaik/web-sdk/portal"
import { createRoute, lazyRouteComponent } from "@tanstack/solid-router"
import { app } from "../manifest"
import "./styles.css"

/**
 * The browser side, mounted by the shell at /${t.id} and loaded the first time someone opens
 * the app. Load pages lazily, so opening the app only loads the page shown.
 */
export default defineWebApp({
  component: () => <AppLayout app={app} />,
  routes: (parent) => [
    createRoute({
      getParentRoute: () => parent,
      path: "/",
      staticData: { title: "${t.name}", keywords: ["${t.id}"] },
      component: lazyRouteComponent(() => import("./pages/home")),
    }),
  ],
})
`,

  "web/api.ts": `import { createApi } from "@mosaik/sdk/solid"
import { Api } from "../api"

/** The API for the pages: queries keyed by the contract (\`api.hello.get.query()\`), and calls (\`useAction\`). */
export const api = createApi(Api)
`,

  "web/pages/home.tsx": `import { css } from "@mosaik/web-sdk/css"
import { useAction } from "@mosaik/sdk/solid"
import { Button, Card${t.database ? ", Stat" : ""} } from "@mosaik/mosaik-ui"
import { QueryBoundary } from "@mosaik/web-sdk/ui"
import { useQuery } from "@tanstack/solid-query"
import { api } from "../api"

export default function Home() {
  const hello = useQuery(() => api.hello.get.query())
  const notify = useAction(api.hello.notify, { success: "Sent: check the bell", failure: "Could not notify you" })

  return (
    <QueryBoundary query={hello}>
      {(data) => (
        <div class={css({ display: "grid", gap: "4", gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)" } })}>
          <Card.Root>
            <Card.Body gap="2">
            <p class={css({ fontSize: "2xl", fontWeight: "semibold" })}>{data().message}</p>
            <p class={css({ color: "fg.muted", fontSize: "sm" })}>${t.name} {data().version}</p>
            <div>
              <Button loading={notify.pending()} onClick={() => void notify.run()}>
                Notify me
              </Button>
            </div>
            </Card.Body>
          </Card.Root>${t.database ? '\n          <Stat label="Greetings served" value={String(data().count)} />' : ""}
        </div>
      )}
    </QueryBoundary>
  )
}
`,

  "web/styles.css": `/*
 * The app's own styles: Panda extracts its classes from web/ and \`mosaikApp()\` keeps only those (the
 * utilities layer). The reset, tokens and components' styles are the shell's; the layer order below
 * places the app's classes as the shell orders its own.
 */
@layer reset, base, tokens, recipes, utilities;
`,

  "vitest.config.ts": `import { defineConfig } from "vitest/config"

/**
 * \`bun run test\`: the app's tests, with the SDK's testing kit (\`@mosaik/sdk/testing\`). The SDK ships
 * TypeScript sources, which Node (running the tests) will not load from node_modules: Vitest compiles
 * it with the tests instead.
 */
export default defineConfig({ test: { server: { deps: { inline: [/node_modules\\/@mosaik\\/sdk\\//] } } } })
`,
  "vite.config.ts": `import { mosaikApp } from "@mosaik/web-sdk/build/vite"
import { defineConfig } from "vite"

/** Builds the browser bundle into dist/web; the backend serves it at /apps/${t.id}/. */
export default defineConfig({ plugins: [mosaikApp()] })
`,

  "panda.config.ts": `import { appPandaConfig } from "@mosaik/web-sdk/build/panda"
import { defineConfig } from "@pandacss/dev"

// Classes are prefixed with the app id, so they never collide with the shell's; values read the shell's \`--mk-\` variables.
export default defineConfig(appPandaConfig({ prefix: "${t.id}", include: ["./web/**/*.{ts,tsx}"] }))
`,

  "scripts/manifest.ts": `/** Writes mosaik-app.json (the manifest with the built bundle); the Portal reads it from the image. */

import { writeAppManifest } from "@mosaik/sdk/build/manifest"
import { app } from "../manifest"

const manifest = await writeAppManifest(app)
console.log(\`mosaik-app.json: \${manifest.id} \${manifest.version} (platform \${manifest.platform})\`)
`,

  "scripts/dev.ts": `/**
 * Development: rebuilds the browser bundle and restarts the backend on change. Install the
 * app in a running platform as "hosted elsewhere" (http://localhost:$PORT) and put its key
 * in .env; then reload the page after changes.
 */

import { runAppDev } from "@mosaik/sdk/build/dev"

await runAppDev()
`,

  Dockerfile: `# The platform runs this image: it reads /app/mosaik-app.json, then starts it with PORT,
# PLATFORM_URL, MOSAIK_APP_KEY, DATABASE_URL and the app's settings in the environment.
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock* ./
COPY vendor ./vendor
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:1.4-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=bun:bun /app /app
USER bun
EXPOSE 3000
CMD ["bun", "server/main.ts"]
`,

  "README.md": `# ${t.name}

A Mosaik app (platform ${t.platformVersion}). It runs **hosted elsewhere** or as a **Docker image the Portal runs**;
either way it talks to the platform only through the platform API with its key.

| | |
|---|---|
| \`manifest.ts\` | id, permissions, roles, notification types, events, settings${t.database ? ", database" : ""} |
| \`api/\` | HTTP API contract shared by server and browser |
| \`server/\` | backend (Bun + Effect), started with \`runApp\` |
| \`web/\` | browser bundle: \`defineWebApp\` in \`web/index.tsx\`, mounted by the shell at \`/${t.id}\` and loaded when first opened; optional \`web/search.ts\` (\`defineSearchProvider\`) for the command palette |
| \`vendor/mosaik/\` | the SDK and the components (\`bun create:app --sdk-only\` in the platform repo refreshes them) |

## Develop

1. \`bun install\`, then \`cp .env.example .env\`.
2. In the platform (\`bun dev\`): Portal → Apps (/portal/apps) → Install app → *Hosted elsewhere*, URL \`http://localhost:4300\`.
   Put the key it shows in \`.env\`.
3. \`bun run dev\`, then open the platform. Reload the page after changing \`web/\`.

## Test

\`bun run test\` runs \`*.test.ts\`. \`@mosaik/sdk/testing\` calls the API in memory as chosen people, through its
real access control, with the platform's services standing in and recording what the app did (export the
handlers' layer from a module of \`server/\` to test it):

\`\`\`ts
layer(AppTest.layer({ app, api: Api, handlers: Handlers }))("${t.name}", (it) => {
  it.effect("needs its permission", () => Effect.gen(function* () {
    const api = yield* AppTest.client(Api)
    const visitor = yield* Effect.flip(api.as(AppTest.visitor, (client) => client.hello.get()))
    expect(visitor._tag).toBe("Unauthorized")
  }))
})
\`\`\`

## Platform events

The app receives the events listed in \`events\` in \`manifest.ts\` (\`user.created\`, \`user.deleted\`,
\`user.access_changed\`), handled in \`server/events.ts\`. They arrive in order and at least once, so make handlers
safe to repeat. A failing handler is retried before later events; operators see the error on the Portal's Apps page
and can skip past it. Events are kept for 30 days: an app away longer gets the \`missed\` handler instead.

## Ship as an image

\`\`\`sh
bun run image                                  # builds ${t.id}:latest
docker tag ${t.id}:latest registry.example.com/team/${t.id}:1.0.0
docker push registry.example.com/team/${t.id}:1.0.0
\`\`\`

Then Portal → Apps → Install app → *Docker image*. Bump \`version\` in \`manifest.ts\` for every release;
update with *Update…* (a release that does not become healthy is rolled back).

The SDK version must match the platform's major version: after a platform major upgrade, update \`vendor/mosaik/\`,
rebuild and update the app.
`,
})
