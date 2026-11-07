/** File templates for `bun create:app`. Keep them in sync with the example apps. */

export interface BuiltinAppTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string
  readonly database: boolean
  readonly public: boolean
}

const pascal = (id: string) => id.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export const files = (t: BuiltinAppTemplate): Record<string, string> => {
  const Api = `${pascal(t.id)}Api`
  const ws = "workspace:*"
  return {
    "package.json": json({
      name: `@mosaik/builtin-${t.id}`,
      version: "0.0.0",
      private: true,
      type: "module",
      exports: { "./manifest": "./manifest.ts", "./api": "./api/index.ts" },
      scripts: { start: "bun server/main.ts", typecheck: "tsc -p ." },
      dependencies: {
        "@mosaik/auth": ws,
        "@mosaik/charts": ws,
        "@mosaik/core": ws,
        ...(t.database ? { "@mosaik/db": ws } : {}),
        "@mosaik/client": ws,
        "@mosaik/frame": ws,
        "@mosaik/server": ws,
        "@mosaik/styled-system": ws,
        "@mosaik/table": ws,
        "@mosaik/mosaik-ui": ws,
        "@mosaik/web-kit": ws,
        "@tanstack/solid-query": "^5.104.3",
        "@tanstack/solid-router": "^1.170.41",
        effect: "^4.1.2",
        "lucide-solid": "^1.70.0",
        "solid-js": "^1.9.17",
      },
    }),

    "tsconfig.json": json({ extends: "../../tsconfig.bun.json", include: ["manifest.ts", "api", "server"] }),

    "manifest.ts": `import { defineApp } from "@mosaik/core"

export const ${t.id.replaceAll("-", "_")} = defineApp({
  id: "${t.id}",
  name: "${t.name}",
  description: "${t.description}",
  access: "view",
  permissions: {
    view: { description: "View ${t.name}", defaultRoles: ["${t.public ? "anonymous" : "authenticated"}"] },
    "items.edit": { description: "Edit items" },
  },
  // What admins and the app's owners give people, smallest first (each includes \`access\`).
  roles: {
    viewer: { name: "Viewer", description: "Sees ${t.name}" },
    editor: { name: "Editor", description: "Also edits items", grants: ["items.*"] },
  },${t.database ? "\n  database: true," : ""}
  // How the shell lists the app (its owners and admins can change the category).
  portal: { icon: "${t.icon}", category: "Other" },
})

export default ${t.id.replaceAll("-", "_")}
`,

    "api/index.ts": `import { AccessControl, RequiredPermission } from "@mosaik/core"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import manifest from "../manifest"

export class Item extends Schema.Class<Item>("@mosaik/${t.id}/Item")({
  id: Schema.Int,
  name: Schema.String,
}) {}

export class ItemsGroup extends HttpApiGroup.make("items")
  .add(
    HttpApiEndpoint.get("list", "/", { success: Schema.Array(Item) }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({ name: Schema.NonEmptyString }),
      success: Item,
    }).annotate(RequiredPermission, manifest.perm("items.edit")),
  )
  .prefix("/items") {}

export class ${Api} extends HttpApi.make("${t.id}").add(ItemsGroup).prefix(manifest.apiPrefix).middleware(AccessControl) {}
`,

    ...(t.database
      ? {
          "server/migrations/0001_items.ts": `import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql\`
    CREATE TABLE items (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  \`
})
`,
          "server/migrations/index.ts": `import type { Migrations } from "@mosaik/db"
import items from "./0001_items"

export const migrations: Migrations = {
  "0001_items": items,
}
`,
        }
      : {}),

    "server/http.ts": t.database
      ? `import { Audit } from "@mosaik/server"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { ${Api}, Item } from "../api"

export const ItemsHandlers = HttpApiBuilder.group(
  ${Api},
  "items",
  Effect.fn(function* (handlers) {
    const sql = yield* SqlClient.SqlClient
    const audit = yield* Audit
    return handlers.handleAll({
      list: () =>
        sql<Item>\`SELECT id, name FROM items ORDER BY id\`.pipe(
          Effect.map((rows) => rows.map((row) => new Item(row))),
          Effect.orDie,
        ),
      create: Effect.fn(function* ({ payload }) {
        const [row] = yield* sql<Item>\`INSERT INTO items (name) VALUES (\${payload.name}) RETURNING id, name\`.pipe(Effect.orDie)
        if (row === undefined) return yield* Effect.die("Insert returned no row")
        yield* audit.record({ action: "items.create", target: row.name })
        return new Item(row)
      }),
    })
  }),
)
`
      : `import { Audit } from "@mosaik/server"
import { Effect, Ref } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { ${Api}, Item } from "../api"

export const ItemsHandlers = HttpApiBuilder.group(
  ${Api},
  "items",
  Effect.fn(function* (handlers) {
    const audit = yield* Audit
    const items = yield* Ref.make<ReadonlyArray<Item>>([new Item({ id: 1, name: "First item" })])
    return handlers.handleAll({
      list: () => Ref.get(items),
      create: Effect.fn(function* ({ payload }) {
        const item = yield* Ref.modify(items, (current) => {
          const created = new Item({ id: current.length + 1, name: payload.name })
          return [created, [...current, created]]
        })
        yield* audit.record({ action: "items.create", target: item.name })
        return item
      }),
    })
  }),
)
`,

    "server/main.ts": `${t.database ? 'import { Database } from "@mosaik/db"\n' : ""}import { runApp } from "@mosaik/server"
${t.database ? 'import { Layer } from "effect"\n' : ""}import { ${Api} } from "../api"
import manifest from "../manifest"
import { ItemsHandlers } from "./http"
${t.database ? 'import { migrations } from "./migrations"\n' : ""}
runApp({
  app: manifest,
  api: ${Api},
  handlers: ${t.database ? `ItemsHandlers.pipe(Layer.provide(Database.layer({ serviceId: manifest.id, migrations })))` : "ItemsHandlers"},
})
`,

    "web/queries.ts": `import { makeApiClient } from "@mosaik/client"
import { queryOptions } from "@tanstack/solid-query"
import { ${Api} } from "../api"
import manifest from "../manifest"

export const api = makeApiClient(${Api})

export const keys = {
  all: [manifest.id] as const,
  items: [manifest.id, "items"] as const,
}

export const itemsQuery = () =>
  queryOptions({ queryKey: keys.items, queryFn: () => api((client) => client.items.list()) })
`,

    "web/routes/route.tsx": `import { AppLayout } from "@mosaik/frame"
import { createFileRoute } from "@tanstack/solid-router"
import manifest from "../../manifest"

export const Route = createFileRoute("/_app/${t.id}")({
  // More pages: list them in the manifest (\`portal.pages\`), and the sidebar shows them.
  component: () => <AppLayout app={manifest} />,
})
`,

    "web/routes/index.tsx": `import { Can } from "@mosaik/auth/web"
import { css } from "@mosaik/styled-system/css"
import { errorMessage, toast } from "@mosaik/client"
import { Button, Card, TextField } from "@mosaik/mosaik-ui"
import { QueryBoundary } from "@mosaik/web-kit"
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query"
import { createFileRoute } from "@tanstack/solid-router"
import { createSignal, For } from "solid-js"
import manifest from "../../manifest"
import { api, itemsQuery, keys } from "../queries"

export const Route = createFileRoute("/_app/${t.id}/")({ component: Overview })

function Overview() {
  const items = useQuery(itemsQuery)
  const queryClient = useQueryClient()
  const [name, setName] = createSignal("")

  const create = useMutation(() => ({
    mutationFn: () => api((client) => client.items.create({ payload: { name: name() } })),
    onSuccess: () => {
      setName("")
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
    onError: (error: unknown) => toast.error("Could not create item", errorMessage(error)),
  }))

  return (
    <Card.Root>
      <Card.Header>
        <Card.Title>Items</Card.Title>
        <Card.Description>Replace this page with your app.</Card.Description>
      </Card.Header>
      <Card.Body>
      <QueryBoundary query={items}>
        {(data) => (
          <ul class={css({ display: "flex", flexDirection: "column", gap: "1", mb: "4" })}>
            <For each={data()}>{(item) => <li>{item.name}</li>}</For>
          </ul>
        )}
      </QueryBoundary>
      <Can permission={manifest.perm("items.edit")}>
        <form
          class={css({ display: "flex", gap: "2" })}
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <TextField aria-label="New item" placeholder="New item" value={name()} onValueChange={setName} />
          <Button type="submit" loading={create.isPending}>
            Add
          </Button>
        </form>
      </Can>
      </Card.Body>
    </Card.Root>
  )
}
`,
  }
}
