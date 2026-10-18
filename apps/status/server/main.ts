import { Live, runApp } from "@mosaik/server"
import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { StatusApi, StatusSnapshot } from "../api"
import { status } from "../manifest"
import { Monitor } from "./Monitor"

const ServicesHandlers = HttpApiBuilder.group(
  StatusApi,
  "services",
  Effect.fn(function* (handlers) {
    const monitor = yield* Monitor
    return handlers.handleAll({
      snapshot: () => monitor.snapshot,
      live: () => Live.eventStream(StatusSnapshot, monitor.changes),
    })
  }),
)

runApp({
  app: status,
  api: StatusApi,
  handlers: ServicesHandlers.pipe(Layer.provide(Monitor.layer)),
})
