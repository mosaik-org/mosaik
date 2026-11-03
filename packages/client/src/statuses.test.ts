import { describe, expect, it } from "vitest"
import { onPageStatusesChange, type PageStatus, pageStatuses, provideStatuses } from "./statuses"

const count = (key: string, n: number): PageStatus => ({
  key,
  description: "Orders waiting for approval",
  value: { _tag: "count", count: n },
  link: "/sales/orders?status=pending",
})

describe("page statuses", () => {
  it("gives pages what the shell provides, by key, and tells them when it changes", () => {
    const seen: Array<number> = []
    const stop = onPageStatusesChange((statuses) => seen.push(statuses.length))
    provideStatuses([count("sales:orders.pending", 3), count("issues:bugs", 1)])
    expect(pageStatuses("sales:orders.pending")).toEqual([count("sales:orders.pending", 3)])
    provideStatuses([])
    stop()
    expect(seen).toEqual([2, 0])
  })
})
