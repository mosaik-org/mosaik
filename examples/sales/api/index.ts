import {
  AccessControl,
  BadRequest,
  Conflict,
  Fresh,
  NotFound,
  RequiredPermission,
  StorageLimitReached,
  StorageUnavailable,
} from "@mosaik/sdk"
import { Schema } from "effect"
import { Multipart } from "effect/http"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { sales } from "../manifest"
import {
  Attachment,
  MAX_ATTACHMENT_BYTES,
  Order,
  OrderId,
  OrderOptions,
  OrderStatus,
  OrdersPage,
  OrdersSearch,
  Refund,
  SalesSummary,
  SummarySearch,
} from "./domain"

export * from "./domain"

export class StatsGroup extends HttpApiGroup.make("stats").add(
  HttpApiEndpoint.get("summary", "/summary", {
    query: SummarySearch.fields,
    success: Fresh(SalesSummary),
  }),
) {}

export class OrdersGroup extends HttpApiGroup.make("orders")
  .add(
    HttpApiEndpoint.get("list", "/", { query: OrdersSearch.fields, success: OrdersPage }),
    /** What the pages show and offer, from Sales' settings. */
    HttpApiEndpoint.get("options", "/options", { success: OrderOptions }),
    /** Refused while exports are off in Sales' settings. */
    HttpApiEndpoint.get("export", "/export.csv", {
      query: { status: OrdersSearch.fields.status, search: OrdersSearch.fields.search },
      success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/csv" })),
      error: Conflict,
    }).annotate(RequiredPermission, sales.perm("orders.export")),
    HttpApiEndpoint.patch("setStatus", "/:id/status", {
      params: { id: OrderId },
      payload: Schema.Struct({ status: OrderStatus }),
      success: Order,
      error: [NotFound, BadRequest],
    }).annotate(RequiredPermission, sales.perm("orders.edit")),
    /** Refused above the largest refund in Sales' settings. */
    HttpApiEndpoint.post("refund", "/:id/refund", {
      params: { id: OrderId },
      payload: Refund,
      success: Order,
      error: [NotFound, Conflict],
    }).annotate(RequiredPermission, sales.perm("orders.refund")),
    HttpApiEndpoint.get("attachments", "/:id/attachments", {
      params: { id: OrderId },
      success: Schema.Array(Attachment),
      error: [NotFound, StorageUnavailable],
    }),
    /** A PDF or an image (`ATTACHMENT_TYPES`), sent as `multipart/form-data` (`uploadFile` in a page). */
    HttpApiEndpoint.post("attach", "/:id/attachments", {
      params: { id: OrderId },
      payload: Schema.Struct({ file: Multipart.SingleFileSchema }).pipe(
        HttpApiSchema.asMultipart({ maxFileSize: MAX_ATTACHMENT_BYTES }),
      ),
      success: Attachment,
      error: [NotFound, BadRequest, StorageLimitReached, StorageUnavailable],
    }).annotate(RequiredPermission, sales.perm("orders.edit")),
    /** The file itself: a download, or shown in the browser with `?inline=true`. */
    HttpApiEndpoint.get("attachment", "/:id/attachments/:name", {
      params: { id: OrderId, name: Schema.String },
      query: { inline: Schema.optional(Schema.Literals(["true", "false"])) },
      success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()),
      error: [NotFound, StorageUnavailable],
    }),
    HttpApiEndpoint.delete("detach", "/:id/attachments/:name", {
      params: { id: OrderId, name: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [NotFound, StorageUnavailable],
    }).annotate(RequiredPermission, sales.perm("orders.edit")),
  )
  .prefix("/orders") {}

export class SalesApi extends HttpApi.make("sales")
  .add(StatsGroup, OrdersGroup)
  .prefix(sales.apiPrefix)
  .middleware(AccessControl) {}
