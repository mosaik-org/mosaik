import { Schema } from "effect"
import { createRoot, createSignal } from "solid-js"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createEventStream } from "./live"

/** Records the connections a stream opens. */
class FakeEventSource {
  static readonly opened: Array<FakeEventSource> = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  closed = false
  constructor(readonly url: string) {
    FakeEventSource.opened.push(this)
  }
  close() {
    this.closed = true
  }
}

// One connection per tab: no BroadcastChannel to share it through.
vi.stubGlobal("EventSource", FakeEventSource)
vi.stubGlobal("BroadcastChannel", undefined)
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  FakeEventSource.opened.length = 0
})

const Ping = Schema.Struct({ n: Schema.Number })

describe("createEventStream", () => {
  it("waits for an address, and connects again only when it changes", () => {
    const [user, setUser] = createSignal<{ readonly id: string }>()
    const dispose = createRoot((dispose) => {
      createEventStream(() => {
        const current = user()
        return current === undefined ? undefined : `/live?as=${current.id}`
      }, Ping)
      return dispose
    })
    expect(FakeEventSource.opened).toEqual([])

    setUser({ id: "ada" })
    expect(FakeEventSource.opened.map((source) => source.url)).toEqual(["/live?as=ada"])

    // What the address reads changed, the address did not: the connection stays.
    setUser({ id: "ada" })
    expect(FakeEventSource.opened).toHaveLength(1)

    setUser({ id: "grace" })
    expect(FakeEventSource.opened.map((source) => source.url)).toEqual(["/live?as=ada", "/live?as=grace"])
    expect(FakeEventSource.opened[0]?.closed).toBe(true)

    dispose()
    expect(FakeEventSource.opened[1]?.closed).toBe(true)
  })

  it("decodes what arrives", () => {
    const stream = createRoot(() => createEventStream("/live", Ping))
    FakeEventSource.opened[0]?.onmessage?.({ data: JSON.stringify({ n: 7 }) })
    expect(stream.data()).toEqual({ n: 7 })
  })
})
