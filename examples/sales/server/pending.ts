import { StatusAudiences } from "@mosaik/sdk"
import { Status } from "@mosaik/sdk/server"
import { Effect, Layer, Schedule } from "effect"
import { sales } from "../manifest"
import { Orders } from "./Orders"

/**
 * Shows the orders waiting for approval beside Orders in Mosaik's navigation, for everyone who can
 * change orders: run it after every change of status. Showing it never fails what changed it.
 */
export const makeShowPendingOrders = Effect.gen(function* () {
  const orders = yield* Orders
  const status = yield* Status.for(sales)
  return Effect.gen(function* () {
    const pending = yield* orders.all({ status: "pending" })
    yield* status.set("orders.pending", StatusAudiences.permission(sales.perm("orders.edit")), pending.length, {
      // Straight to them: Orders, showing the pending ones.
      link: "/orders?status=pending",
    })
  }).pipe(Effect.catchTag("StatusError", (error) => Effect.logWarning("Could not show the orders waiting", error)))
})

/** Counted when Sales starts, then every few minutes: orders changed elsewhere (a script, the database) show too. */
export const PendingOrdersStatus = Layer.effectDiscard(
  Effect.flatMap(makeShowPendingOrders, (show) =>
    show.pipe(Effect.repeat(Schedule.spaced("5 minutes")), Effect.forkScoped),
  ),
)
