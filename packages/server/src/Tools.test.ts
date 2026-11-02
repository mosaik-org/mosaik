import { describe, expect, it } from "@effect/vitest"
import { AccessControl, AgentTool, defineApp, RequiredPermission } from "@mosaik/core"
import { Schema } from "effect"
import { Multipart } from "effect/http"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { appTools } from "./Tools"

const shop = defineApp({
  id: "shop",
  name: "Shop",
  access: "view",
  permissions: {
    view: { description: "See orders" },
    "orders.refund": { description: "Refund orders", dangerous: true },
  },
})

class Refund extends Schema.Class<Refund>("Refund")({ reason: Schema.String }) {}

class OrdersGroup extends HttpApiGroup.make("orders")
  .add(
    HttpApiEndpoint.get("search", "/", {
      query: { text: Schema.optional(Schema.String) },
      success: Schema.Array(Schema.String),
    }).annotate(AgentTool, { description: "Find orders by number or customer", title: "Find orders" }),
    HttpApiEndpoint.post("refund", "/:id/refund", {
      params: { id: Schema.NumberFromString },
      payload: Refund,
      success: Schema.String,
    })
      .annotate(RequiredPermission, shop.perm("orders.refund"))
      .annotate(AgentTool, { description: "Refund a paid order" }),
    HttpApiEndpoint.get("export", "/export.csv", { success: Schema.String }),
  )
  .prefix("/orders") {}

class ShopApi extends HttpApi.make("shop").add(OrdersGroup).prefix(shop.apiPrefix).middleware(AccessControl) {}

describe("appTools", () => {
  const { app, tools } = appTools(shop, ShopApi)

  it("offers the annotated endpoints only, with their full paths", () => {
    expect(app).toBe("shop")
    expect(tools.map((tool) => [tool.name, tool.method, tool.path])).toEqual([
      ["orders.search", "GET", "/api/shop/orders"],
      ["orders.refund", "POST", "/api/shop/orders/:id/refund"],
    ])
  })

  it("says what calling each takes, and whether it changes or destroys anything", () => {
    const [search, refund] = tools
    expect(search).toMatchObject({ title: "Find orders", permission: "shop:view", readOnly: true, destructive: false })
    // Without a title, the endpoint's name; the permission is dangerous in the manifest.
    expect(refund).toMatchObject({
      title: "orders.refund",
      permission: "shop:orders.refund",
      readOnly: false,
      destructive: true,
    })
  })

  it("describes each input in its JSON form", () => {
    const [search, refund] = tools
    expect(search?.params).toBeNull()
    expect(search?.payload).toBeNull()
    expect(search?.query?.schema).toMatchObject({ type: "object", properties: { text: expect.anything() } })
    // Path parameters are text in a URL: the AI passes them as such.
    expect(refund?.params?.schema).toMatchObject({ type: "object", properties: { id: { type: "string" } } })
    expect(refund?.payload?.definitions).toHaveProperty("RefundEncoded")
  })

  it("refuses an offered endpoint that does not take JSON", () => {
    class UploadGroup extends HttpApiGroup.make("files").add(
      HttpApiEndpoint.post("upload", "/files", {
        payload: Schema.Struct({ file: Multipart.SingleFileSchema }).pipe(HttpApiSchema.asMultipart()),
        success: Schema.String,
      }).annotate(AgentTool, { description: "Upload a file" }),
    ) {}
    class UploadApi extends HttpApi.make("shop").add(UploadGroup).prefix(shop.apiPrefix) {}
    expect(() => appTools(shop, UploadApi)).toThrow(
      "files.upload is offered to AI clients, but only endpoints taking JSON can be",
    )
  })
})
