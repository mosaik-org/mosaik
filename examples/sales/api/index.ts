import { AccessControl, BadRequest, Conflict, Fresh, NotFound, RequiredPermission } from "@mosaik/sdk"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { sales } from "../manifest"
import {
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
  )
  .prefix("/orders") {}

export class SalesApi extends HttpApi.make("sales")
  .add(StatsGroup, OrdersGroup)
  .prefix(sales.apiPrefix)
  .middleware(AccessControl) {}
