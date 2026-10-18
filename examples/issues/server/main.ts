import type { ConnectorError } from "@mosaik/sdk/connectors"
import { runApp } from "@mosaik/sdk/server"
import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { IssuesApi } from "../api"
import { issues } from "../manifest"
import { Issues } from "./Issues"

/** Jira failures become a 502 for the browser; details stay in the logs. */
const asUpstreamError = <A>(effect: Effect.Effect<A, ConnectorError>) =>
  effect.pipe(
    Effect.tapError((error) => Effect.logWarning("Jira request failed", error.reason, error.message)),
    Effect.mapError((error) => error.toUpstreamError()),
  )

const IssuesHandlers = HttpApiBuilder.group(
  IssuesApi,
  "issues",
  Effect.fn(function* (handlers) {
    const service = yield* Issues
    return handlers.handleAll({
      list: ({ query }) => asUpstreamError(service.list(query)),
      projects: () => asUpstreamError(service.projects),
    })
  }),
)

runApp({ app: issues, api: IssuesApi, handlers: IssuesHandlers.pipe(Layer.provide(Issues.layer)) })
