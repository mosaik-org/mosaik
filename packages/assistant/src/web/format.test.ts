import { describe, expect, it } from "vitest"
import type { TurnEvent } from "../contract"
import { readEvents } from "./events"
import { inputFields } from "./format"

describe("inputFields", () => {
  it("lists a call's values under their own names", () => {
    expect(inputFields({ path: { id: "7" }, body: { reason: "Damaged", lines: [1, 2] } })).toEqual([
      ["id", "7"],
      ["reason", "Damaged"],
      ["lines", "[1,2]"],
    ])
    expect(inputFields(null)).toEqual([])
  })
})

describe("readEvents", () => {
  it("reads events split anywhere across chunks, skipping heartbeats", async () => {
    const text = `: heartbeat\n\ndata: {"type":"text","text":"Hel"}\n\ndata: {"type":"text","text":"lo"}\n\ndata: {"type":"done"}\n\n`
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let at = 0; at < text.length; at += 7) controller.enqueue(encoder.encode(text.slice(at, at + 7)))
        controller.close()
      },
    })
    const events: Array<TurnEvent> = []
    await readEvents(body, (event) => events.push(event))
    expect(events).toEqual([{ type: "text", text: "Hel" }, { type: "text", text: "lo" }, { type: "done" }])
  })
})
