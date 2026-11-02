import { Schema } from "effect"
import { TurnEvent } from "../contract"

const decodeEvent = Schema.decodeUnknownSync(Schema.toCodecJson(TurnEvent))

/** Calls `onEvent` for each `data:` event of a Server-Sent Events body, however its chunks split it. */
export const readEvents = async (
  body: ReadableStream<Uint8Array>,
  onEvent: (event: TurnEvent) => void,
): Promise<void> => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""
    for (const event of events) {
      for (const line of event.split("\n")) {
        // Comments (`: heartbeat`) keep the connection open; only `data:` lines are events.
        if (line.startsWith("data: ")) onEvent(decodeEvent(JSON.parse(line.slice("data: ".length))))
      }
    }
  }
}
