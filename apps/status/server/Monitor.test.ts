import { describe, expect, it } from "@effect/vitest"
import { type ServiceState, ServiceStatus } from "../api"
import { transitions } from "./Monitor"

const service = (name: string, state: ServiceState) =>
  new ServiceStatus({ name, state, latencyMs: null, history: [], checkedAt: null })

describe("transitions", () => {
  it("reports services going down and recovering", () => {
    expect(
      transitions(
        [service("auth", "up"), service("sales", "down"), service("issues", "degraded")],
        [service("auth", "down"), service("sales", "up"), service("issues", "down")],
      ),
    ).toEqual([
      { name: "auth", change: "down" },
      { name: "sales", change: "recovered" },
      { name: "issues", change: "down" },
    ])
  })

  it("ignores the first check and unchanged states", () => {
    expect(transitions([service("auth", "unknown")], [service("auth", "down")])).toEqual([])
    expect(transitions([service("auth", "down")], [service("auth", "down")])).toEqual([])
    expect(transitions([service("auth", "up")], [service("auth", "degraded")])).toEqual([])
  })
})
