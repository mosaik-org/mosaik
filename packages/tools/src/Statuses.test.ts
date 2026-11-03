import { PersonStatus } from "@mosaik/platform/contract"
import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { describeStatuses, waitingLine } from "./Statuses"

const status = (key: string, app: string | null, path: string, value: PersonStatus["value"], description: string) =>
  new PersonStatus({
    key,
    app,
    description,
    kind: value._tag,
    tone: "attention",
    path,
    link: path,
    value,
    updatedAt: DateTime.makeUnsafe(0),
  })

const statuses = [
  status("sales:orders.pending", "sales", "/sales/orders", { _tag: "count", count: 3 }, "Orders waiting for approval"),
  status(
    "core:access.requests",
    null,
    "/access-requests",
    { _tag: "count", count: 2 },
    "Access requests waiting for your answer",
  ),
  status("sales:import", "sales", "/sales", { _tag: "running", progress: 0.4, label: "Importing orders" }, "Import"),
]

describe("statuses for AI", () => {
  it("lists each with its app and the page it is about", () => {
    expect(describeStatuses(statuses)).toBe(
      [
        "- sales: Orders waiting for approval: 3 (/sales/orders)",
        "- Mosaik: Access requests waiting for your answer: 2 (/access-requests)",
        "- sales: Importing orders (40%) (/sales)",
      ].join("\n"),
    )
    expect(describeStatuses([])).toBe("Nothing waits for the person.")
  })

  it("says it in one line for the person's message, and nothing when nothing waits", () => {
    expect(waitingLine(statuses.slice(0, 1))).toBe(
      "[Waiting for the person: sales: Orders waiting for approval: 3 (/sales/orders).]",
    )
    expect(waitingLine([])).toBeUndefined()
  })
})
