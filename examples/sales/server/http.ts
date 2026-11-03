import { BadRequest, Conflict, CurrentPrincipal, type StoredObject, storageKeyProblem } from "@mosaik/sdk"
import { Audiences, Audit, Notify, Settings, Storage } from "@mosaik/sdk/server"
import { DateTime, Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import {
  ATTACHMENT_TYPES,
  Attachment,
  ORDERS_DEFAULTS,
  type Order,
  type OrderId,
  OrderOptions,
  SalesApi,
  SUMMARY_DEFAULTS,
} from "../api"
import { sales } from "../manifest"
import { money } from "./money"
import { Orders } from "./Orders"
import { makeShowPendingOrders } from "./pending"

const csvCell = (value: string | number): string => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const toCsv = (orders: ReadonlyArray<Order>): string =>
  [
    ["number", "customer", "email", "region", "status", "amount", "created_at"].join(","),
    ...orders.map((o) =>
      [
        o.number,
        o.customer,
        o.email,
        o.region,
        o.status,
        (o.amountCents / 100).toFixed(2),
        DateTime.formatIso(o.createdAt),
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n")

const StatsHandlers = HttpApiBuilder.group(
  SalesApi,
  "stats",
  Effect.fn(function* (handlers) {
    const orders = yield* Orders
    return handlers.handle("summary", ({ query }) => orders.summary(query.days ?? SUMMARY_DEFAULTS.days))
  }),
)

/** Where an order's attachments are kept in Sales' storage. */
const folder = (id: OrderId) => `orders/${id}/`

/** What cannot be in an attachment's name: control characters and path separators. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it replaces
const UNSAFE_IN_NAMES = /[\u0000-\u001f\u007f/\\]/g

/** A file's name as an attachment: one path segment, no control characters, at most 200 characters. */
const attachmentName = (name: string) => {
  const cleaned = name.replace(UNSAFE_IN_NAMES, "_").trim().slice(-200)
  return storageKeyProblem(cleaned) === undefined ? cleaned : "file"
}

const toAttachment = (id: OrderId, object: StoredObject) =>
  new Attachment({
    name: object.key.slice(folder(id).length),
    size: object.size,
    contentType: object.contentType,
    uploadedAt: object.updatedAt,
  })

const OrdersHandlers = HttpApiBuilder.group(
  SalesApi,
  "orders",
  Effect.fn(function* (handlers) {
    const orders = yield* Orders
    const audit = yield* Audit
    const notify = yield* Notify
    // Read on every request: owners change them while Sales runs.
    const settings = yield* Settings.for(sales)
    const storage = yield* Storage
    const showPendingOrders = yield* makeShowPendingOrders

    return handlers.handleAll({
      list: ({ query }) => orders.list({ ...ORDERS_DEFAULTS, ...query }),

      options: Effect.fn(function* () {
        const { exportsEnabled, refundLimit } = yield* settings.all
        return new OrderOptions({ exportsEnabled, refundLimitCents: Math.round(refundLimit * 100) })
      }),

      export: Effect.fn(function* ({ query }) {
        if (!(yield* settings.get("exportsEnabled"))) {
          return yield* new Conflict({ message: "Exports are switched off in Sales' settings" })
        }
        const rows = yield* orders.all(query)
        yield* audit.record({ action: "orders.export", details: { rows: rows.length, ...query } })
        return toCsv(rows)
      }),

      setStatus: Effect.fn(function* ({ params, payload }) {
        const order = yield* orders.setStatus(params.id, payload.status)
        yield* audit.record({ action: "orders.set-status", target: order.number, details: { status: payload.status } })
        yield* showPendingOrders
        return order
      }),

      refund: Effect.fn(function* ({ params, payload }) {
        // A rule of Sales' own, read at every refund: owners change the limit while Sales runs.
        const largestCents = Math.round((yield* settings.get("refundLimit")) * 100)
        if ((yield* orders.get(params.id)).amountCents > largestCents) {
          return yield* new Conflict({
            message: `Refunds above ${money.format(largestCents / 100)} are handled by finance (Sales' settings)`,
          })
        }
        const order = yield* orders.refund(params.id, payload.reason)
        yield* audit.record({
          action: "orders.refund",
          target: order.number,
          details: { reason: payload.reason, amountCents: order.amountCents },
        })
        // Tell the others who handle refunds; a failed notification never fails the refund.
        const actor = (yield* CurrentPrincipal).user
        yield* notify
          .send({
            type: sales.notification("order.refunded"),
            audience: Audiences.permission(sales.perm("orders.refund")),
            exclude: actor === null ? [] : [actor.id],
            content: {
              title: `${order.number} was refunded`,
              body: `${actor?.name ?? "Someone"} refunded ${order.customer}.\n\nReason: ${payload.reason}`,
              fields: [
                { label: "Amount", value: money.format(order.amountCents / 100) },
                { label: "Region", value: order.region },
              ],
              link: `/sales/orders?search=${encodeURIComponent(order.number)}`,
              linkLabel: "View order",
            },
            idempotencyKey: `refund-${order.id}`,
          })
          .pipe(Effect.ignore)
        return order
      }),

      attachments: Effect.fn(function* ({ params }) {
        yield* orders.get(params.id)
        const page = yield* storage.list({ prefix: folder(params.id), limit: 1000 })
        return page.objects.map((object) => toAttachment(params.id, object))
      }),

      // Sales decides what it takes: the platform stores any file, and only counts.
      attach: Effect.fn(function* ({ params, payload: { file } }) {
        const order = yield* orders.get(params.id)
        if (!(ATTACHMENT_TYPES as ReadonlyArray<string>).includes(file.contentType)) {
          return yield* new BadRequest({ message: "Attach a PDF or an image (PNG, JPEG or WebP)" })
        }
        const name = attachmentName(file.name)
        const stored = yield* storage.put(`${folder(params.id)}${name}`, file)
        yield* audit.record({ action: "orders.attach", target: order.number, details: { name, size: stored.size } })
        return toAttachment(params.id, stored)
      }),

      // Served by the SDK: a download, or an image or PDF shown in place, never run as Sales' page.
      attachment: ({ params, query }) =>
        storage.respond(`${folder(params.id)}${params.name}`, {
          inline: query.inline === "true",
          filename: params.name,
        }),

      detach: Effect.fn(function* ({ params }) {
        const order = yield* orders.get(params.id)
        const key = `${folder(params.id)}${params.name}`
        yield* storage.head(key)
        yield* storage.delete(key)
        yield* audit.record({ action: "orders.detach", target: order.number, details: { name: params.name } })
      }),
    })
  }),
)

/** The API's handlers, for any `Orders`: Postgres in production, in memory in tests. */
export const ApiHandlers = Layer.mergeAll(StatsHandlers, OrdersHandlers)

export const Handlers = ApiHandlers.pipe(Layer.provide(Orders.layer))
