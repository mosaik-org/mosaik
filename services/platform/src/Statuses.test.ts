import { describe, expect, it } from "@effect/vitest"
import { Principal, PrincipalUser, type StatusAudience, StatusAudiences, UserId } from "@mosaik/core"
import { StatusDeclaration } from "@mosaik/platform/contract"
import { DateTime, Option } from "effect"
import { type AppStatuses, audienceKey, audienceOf, entryProblem, type StoredStatus, toPersonStatus } from "./Statuses"

const ada = UserId.make("ada")
const person = (grants: ReadonlyArray<string>, id = ada) =>
  new Principal({
    user: new PrincipalUser({ id, email: `${id}@example.com`, name: id, image: null }),
    grants: [...grants],
  })

const pending = new StatusDeclaration({
  name: "orders.pending",
  description: "Orders waiting for approval",
  kind: "count",
  page: "/orders",
  tone: "attention",
})
const health = new StatusDeclaration({
  name: "health",
  description: "Payments",
  kind: "health",
  page: null,
  tone: "attention",
})
const sales: Option.Option<AppStatuses> = Option.some({
  access: "sales:view",
  declarations: new Map([
    [pending.name, pending],
    [health.name, health],
  ]),
})

const at = DateTime.makeUnsafe("2026-11-03T09:00:00Z")
const stored = (
  audience: StatusAudience,
  value: StoredStatus["value"] = { _tag: "count", count: 3 },
  name = "orders.pending",
): StoredStatus => ({ owner: "sales", name, audience, value, link: null, expiresAt: null, updatedAt: at })

describe("audiences", () => {
  it("come back as they were stored, a permission's own colon included", () => {
    for (const audience of [StatusAudiences.user(ada), StatusAudiences.permission("sales:orders.edit")]) {
      expect(audienceOf(audienceKey(audience))).toEqual(Option.some(audience))
    }
    expect(audienceOf("team:sales")).toEqual(Option.none())
    expect(audienceOf("permission:not-a-key")).toEqual(Option.none())
  })
})

describe("toPersonStatus", () => {
  it("shows a value to its person, or to everyone with its permission who may open the app", () => {
    const forEditors = stored(StatusAudiences.permission("sales:orders.edit"))
    const seen = toPersonStatus(person(["sales:view", "sales:orders.edit"]), forEditors, sales)
    expect(Option.map(seen, ({ key, path, description, value }) => ({ key, path, description, value }))).toEqual(
      Option.some({
        key: "sales:orders.pending",
        path: "/sales/orders",
        description: "Orders waiting for approval",
        value: { _tag: "count", count: 3 },
      }),
    )
    expect(toPersonStatus(person(["sales:view"]), forEditors, sales)).toEqual(Option.none())
    // Without opening the app, nothing of it shows.
    expect(toPersonStatus(person(["sales:orders.edit"]), forEditors, sales)).toEqual(Option.none())
    expect(toPersonStatus(person(["sales:view"]), stored(StatusAudiences.user(ada)), sales)._tag).toBe("Some")
    expect(toPersonStatus(person(["sales:view"], UserId.make("bo")), stored(StatusAudiences.user(ada)), sales)).toEqual(
      Option.none(),
    )
  })

  it("drops values the app no longer declares, and lets trouble say how bad it is", () => {
    const everyone = StatusAudiences.permission("sales:view")
    expect(toPersonStatus(person(["*"]), stored(everyone, undefined, "gone"), sales)).toEqual(Option.none())
    const trouble = stored(everyone, { _tag: "health", level: "danger", label: "The bank does not answer" }, "health")
    expect(Option.map(toPersonStatus(person(["*"]), trouble, sales), (status) => [status.tone, status.path])).toEqual(
      Option.some(["danger", "/sales"]),
    )
  })

  it("leads to the things it is about, under the app's address, or to its page", () => {
    const linked = { ...stored(StatusAudiences.user(ada)), link: "/orders?status=pending" }
    expect(Option.map(toPersonStatus(person(["*"]), linked, sales), (status) => status.link)).toEqual(
      Option.some("/sales/orders?status=pending"),
    )
    expect(Option.map(toPersonStatus(person(["*"]), stored(StatusAudiences.user(ada)), sales), (s) => s.link)).toEqual(
      Option.some("/sales/orders"),
    )
  })

  it("places Core's own statuses on Core's pages", () => {
    const core: StoredStatus = { ...stored(StatusAudiences.user(ada)), owner: "core", name: "assistant.approvals" }
    expect(Option.map(toPersonStatus(person([]), core, Option.none()), (status) => status.path)).toEqual(
      Option.some("/assistant"),
    )
  })
})

describe("entryProblem", () => {
  const editors = StatusAudiences.permission("sales:orders.edit")
  it("accepts values that fit the declaration, for the app's own permissions", () => {
    expect(
      entryProblem("sales", pending, { audience: editors, link: null, value: { _tag: "count", count: 2 } }),
    ).toBeUndefined()
    expect(entryProblem("sales", pending, { audience: editors, link: null, value: null })).toBeUndefined()
  })

  it("refuses undeclared statuses, other kinds and other apps' permissions", () => {
    expect(entryProblem("sales", undefined, { audience: editors, link: null, value: null })).toMatch(
      /not in the app's manifest/,
    )
    expect(
      entryProblem("sales", pending, {
        audience: editors,
        link: null,
        value: { _tag: "running", progress: null, label: null },
      }),
    ).toMatch(/count status/)
    expect(
      entryProblem("sales", pending, {
        audience: StatusAudiences.permission("admin:users.manage"),
        link: null,
        value: { _tag: "count", count: 1 },
      }),
    ).toMatch(/own permissions/)
  })
})
