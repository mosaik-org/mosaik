import { describe, expect, it } from "@effect/vitest"
import { fromResponse, toModelMessages } from "./Model"

describe("toModelMessages", () => {
  it("turns stored messages into the library's, with calls, results and the provider's options", () => {
    expect(
      toModelMessages([
        { role: "user", parts: [{ type: "text", text: "Refund 7" }] },
        {
          role: "assistant",
          parts: [
            { type: "reasoning", text: "They want a refund", providerOptions: { opencode: { signature: "s" } } },
            {
              type: "tool-call",
              id: "c1",
              tool: "shop_orders_refund",
              input: { path: { id: "7" } },
              title: "Refund",
              app: "shop",
              changes: true,
              destructive: true,
            },
          ],
        },
        {
          role: "tool",
          parts: [
            { type: "tool-result", id: "c1", tool: "shop_orders_refund", ok: true, text: "{}", decision: "approved" },
            { type: "tool-result", id: "c2", tool: "shop_orders_refund", ok: false, text: "No", decision: "denied" },
            { type: "tool-result", id: "c3", tool: "shop_orders_search", ok: false, text: "403" },
          ],
        },
      ]),
    ).toEqual([
      { role: "user", content: [{ type: "text", text: "Refund 7" }] },
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "They want a refund", providerOptions: { opencode: { signature: "s" } } },
          { type: "tool-call", toolCallId: "c1", toolName: "shop_orders_refund", input: { path: { id: "7" } } },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "c1",
            toolName: "shop_orders_refund",
            output: { type: "text", value: "{}" },
          },
          {
            type: "tool-result",
            toolCallId: "c2",
            toolName: "shop_orders_refund",
            output: { type: "execution-denied", reason: "No" },
          },
          {
            type: "tool-result",
            toolCallId: "c3",
            toolName: "shop_orders_search",
            output: { type: "error-text", value: "403" },
          },
        ],
      },
    ])
  })
})

describe("fromResponse", () => {
  it("keeps the reply's text, reasoning and calls", () => {
    expect(
      fromResponse([
        {
          role: "assistant",
          content: [
            { type: "reasoning", text: "Hmm", providerOptions: { anthropic: { signature: "x" } } },
            { type: "text", text: "Looking" },
            { type: "text", text: "" },
            { type: "tool-call", toolCallId: "c1", toolName: "shop_orders_search", input: { query: {} } },
          ],
        },
      ]),
    ).toEqual([
      { type: "reasoning", text: "Hmm", providerOptions: { anthropic: { signature: "x" } } },
      { type: "text", text: "Looking" },
      { type: "tool-call", id: "c1", tool: "shop_orders_search", input: { query: {} } },
    ])
    expect(fromResponse([{ role: "assistant", content: "Hello" }])).toEqual([{ type: "text", text: "Hello" }])
  })
})
