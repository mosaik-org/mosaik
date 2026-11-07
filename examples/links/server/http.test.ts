import { expect, layer } from "@effect/vitest"
import { AppTest, TestAudit } from "@mosaik/sdk/testing"
import { Effect, Layer } from "effect"
import { LinksApi, NewLink } from "../api"
import { links } from "../manifest"
import { ApiHandlers } from "./http"
import { InMemoryLinks } from "./Links"

const reader = AppTest.user({ id: "grace", name: "Grace", grants: [links.accessPermission] })
const ada = AppTest.user({ id: "ada", name: "Ada", grants: [links.accessPermission, links.perm("links.add")] })
const lin = AppTest.user({ id: "lin", name: "Lin", grants: [links.accessPermission, links.perm("links.add")] })
const curator = AppTest.user({ id: "cy", name: "Cy", grants: [links.accessPermission, "links:links.*"] })

const app = AppTest.layer({
  app: links,
  api: LinksApi,
  handlers: ApiHandlers.pipe(Layer.provide(InMemoryLinks)),
})

const docs = new NewLink({ title: "Docs", url: "https://example.com/docs" })

layer(app)("Links", (it) => {
  it.effect("are added by those allowed to, audited, and kept with who added them", () =>
    Effect.gen(function* () {
      const api = yield* AppTest.client(LinksApi)
      const refused = yield* Effect.flip(api.as(reader, (client) => client.links.add({ payload: docs })))
      expect(refused._tag).toBe("Forbidden")

      const added = yield* api.as(ada, (client) => client.links.add({ payload: docs }))
      expect(added.addedBy.name).toBe("Ada")
      expect(yield* (yield* TestAudit).entries).toContainEqual(
        expect.objectContaining({ action: "links.add", target: String(added.id) }),
      )
      const all = yield* api.as(reader, (client) => client.links.list())
      expect(all.map((link) => link.title)).toContain("Docs")
    }),
  )

  it.effect("are removed by whoever added them or a curator, and nobody else", () =>
    Effect.gen(function* () {
      const api = yield* AppTest.client(LinksApi)
      const mine = yield* api.as(ada, (client) => client.links.add({ payload: docs }))
      const other = yield* Effect.flip(api.as(lin, (client) => client.links.remove({ params: { id: mine.id } })))
      expect(other._tag).toBe("NotFound")

      yield* api.as(ada, (client) => client.links.remove({ params: { id: mine.id } }))
      const again = yield* api.as(ada, (client) => client.links.add({ payload: docs }))
      yield* api.as(curator, (client) => client.links.remove({ params: { id: again.id } }))
      const all = yield* api.as(reader, (client) => client.links.list())
      expect(all.map((link) => link.id)).not.toContain(mine.id)
      expect(all.map((link) => link.id)).not.toContain(again.id)
    }),
  )
})
