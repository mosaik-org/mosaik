import { Schema } from "effect"
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"

export type EventStreamStatus = "connecting" | "open" | "reconnecting"

export interface EventStream<A> {
  /** Latest decoded event, `undefined` until the first one arrives. */
  readonly data: Accessor<A | undefined>
  readonly status: Accessor<EventStreamStatus>
}

/** What the tab holding a stream's connection tells the others. */
type TabMessage =
  | { readonly kind: "event"; readonly data: string }
  | { readonly kind: "status"; readonly status: EventStreamStatus }
  /** A tab joined and wants to know the status. */
  | { readonly kind: "hello" }

const canShare = () =>
  typeof BroadcastChannel !== "undefined" && typeof navigator !== "undefined" && "locks" in navigator

/**
 * Subscribes to a Server-Sent Events endpoint (see `Live.eventStream` in `@mosaik/server`)
 * and decodes every event with `schema`. Reconnects automatically; closes on cleanup.
 *
 * The tabs of a browser share one connection per URL: browsers allow only six
 * connections per site over HTTP/1.1, and every open stream holds one. One tab connects
 * (whichever holds the Web Lock for the URL) and passes events on to the others; when it
 * closes, another takes over.
 */
export const createEventStream = <S extends Schema.Codec<any, any>>(
  url: string | Accessor<string>,
  schema: S,
): EventStream<S["Type"]> => {
  const decode = Schema.decodeUnknownSync(Schema.toCodecJson(schema))
  const [data, setData] = createSignal<S["Type"]>()
  const [status, setStatus] = createSignal<EventStreamStatus>("connecting")

  const receive = (raw: string) => {
    try {
      setData(() => decode(JSON.parse(raw)))
    } catch (error) {
      console.error("Invalid event", error)
    }
  }

  /** Opens the connection; `share` passes on what it sees. Returns how to close it. */
  const connect = (target: string, share: (message: TabMessage) => void) => {
    const source = new EventSource(target)
    const report = (next: EventStreamStatus) => {
      setStatus(next)
      share({ kind: "status", status: next })
    }
    source.onopen = () => report("open")
    source.onerror = () => report("reconnecting")
    source.onmessage = (event: MessageEvent<string>) => {
      receive(event.data)
      share({ kind: "event", data: event.data })
    }
    return () => source.close()
  }

  createEffect(() => {
    const target = typeof url === "function" ? url() : url
    if (!canShare()) {
      onCleanup(connect(target, () => {}))
      return
    }

    const name = `mosaik-live:${target}`
    const channel = new BroadcastChannel(name)
    const stop = new AbortController()
    let leading = false
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data
      if (message.kind === "event") receive(message.data)
      else if (message.kind === "status") setStatus(message.status)
      else if (leading) channel.postMessage({ kind: "status", status: status() } satisfies TabMessage)
    }
    // Held until this tab stops listening; the next tab waiting for it then connects.
    navigator.locks
      .request(name, { signal: stop.signal }, () => {
        leading = true
        const close = connect(target, (message) => channel.postMessage(message))
        return new Promise<void>((release) =>
          stop.signal.addEventListener("abort", () => {
            close()
            release()
          }),
        )
      })
      // Aborted while still waiting for the lock: nothing to undo.
      .catch(() => {})
    channel.postMessage({ kind: "hello" } satisfies TabMessage)

    onCleanup(() => {
      stop.abort()
      channel.close()
    })
  })

  return { data, status }
}
