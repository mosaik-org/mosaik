import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { createComponent, createRoot } from "solid-js"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useLiveAccess } from "./live"

/** The access stream, driven by the test. */
class FakeEventSource {
  static readonly opened: Array<FakeEventSource> = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  constructor(readonly url: string) {
    FakeEventSource.opened.push(this)
  }
  close() {}
  send(user: string | null) {
    this.onmessage?.({ data: JSON.stringify({ user }) })
  }
}

/** What the session endpoint answers: the user's grants, changed by the test. */
let grants: Array<string> = ["sales:view"]
const session = vi.fn(async () =>
  Response.json({
    principal: { user: { id: "u1", email: "ada@example.com", name: "Ada", image: null }, grants, agent: null },
    providers: { password: true, microsoft: false },
  }),
)

vi.stubGlobal("EventSource", FakeEventSource)
vi.stubGlobal("BroadcastChannel", undefined)
vi.stubGlobal("location", { origin: "http://mosaik.test" })
vi.stubGlobal("fetch", session)
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** Lets the session load (or reload) and what follows it run. */
const settle = async () => {
  await vi.advanceTimersByTimeAsync(2_500)
}

describe("useLiveAccess", () => {
  it("connects once the session is known, and refreshes what depends on access only when it changed", async () => {
    const onChange = vi.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const dispose = createRoot((dispose) => {
      createComponent(QueryClientProvider, {
        client: queryClient,
        get children() {
          useLiveAccess(onChange)
          return null
        },
      })
      return dispose
    })

    await settle()
    // Not first as a visitor while the session loads: as the user, once.
    expect(FakeEventSource.opened.map((source) => source.url)).toEqual(["/api/auth/identity/live?as=u1"])
    const stream = FakeEventSource.opened[0] as FakeEventSource
    expect(session).toHaveBeenCalledTimes(1)

    // The stream opens with a change for everyone: the session reloads, nothing else.
    stream.send(null)
    await settle()
    expect(session).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
    // And the reload did not reconnect the stream (which would open with that change again).
    expect(FakeEventSource.opened).toHaveLength(1)

    // An owner gave the user a role.
    grants = ["sales:view", "sales:refund"]
    stream.send("u1")
    await settle()
    expect(session).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenCalledTimes(1)

    dispose()
  })
})
