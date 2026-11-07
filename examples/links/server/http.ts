import { CurrentPrincipal, NotFound } from "@mosaik/sdk"
import { Audit } from "@mosaik/sdk/server"
import { Effect, Option } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { LinksApi, Person } from "../api"
import { links } from "../manifest"
import { Links } from "./Links"

/** The signed-in user: every endpoint that changes something needs a permission, so there always is one. */
const signedIn = Effect.flatMap(CurrentPrincipal, ({ user }) =>
  user === null
    ? Effect.die("AccessControl lets only signed-in users change links")
    : Effect.succeed(new Person({ id: user.id, name: user.name })),
)

export const ApiHandlers = HttpApiBuilder.group(
  LinksApi,
  "links",
  Effect.fn(function* (handlers) {
    const store = yield* Links
    const audit = yield* Audit

    return handlers.handleAll({
      list: () => store.list,

      add: Effect.fn(function* ({ payload }) {
        const added = yield* store.add(payload, yield* signedIn)
        yield* audit.record({ action: "links.add", target: String(added.id), details: { url: added.url } })
        return added
      }),

      remove: Effect.fn(function* ({ params }) {
        const principal = yield* CurrentPrincipal
        const link = yield* store.get(params.id)
        const theirs = Option.exists(link, (link) => link.addedBy.id === principal.user?.id)
        // Someone else's link says "not found" rather than "forbidden": as if it were not theirs to see removed.
        if (Option.isNone(link) || (!theirs && !principal.can(links.perm("links.remove")))) {
          return yield* new NotFound({ resource: "link", id: String(params.id) })
        }
        yield* store.remove(params.id)
        yield* audit.record({ action: "links.remove", target: String(params.id), details: { own: theirs } })
      }),
    })
  }),
)
