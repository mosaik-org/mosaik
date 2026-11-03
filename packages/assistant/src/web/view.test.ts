import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { ConversationSummary, Message, type ToolCallPart, type ToolResultPart } from "../contract"
import {
  activitySummary,
  callStatus,
  conversationItems,
  groupByDate,
  liveActivity,
  matchingConversations,
  replyParts,
  resultsOf,
} from "./view"

const call = (id: string, title = "Find orders", changes = false): ToolCallPart => ({
  type: "tool-call",
  id,
  tool: "shop_orders_list",
  input: {},
  title,
  app: "shop",
  changes,
  destructive: false,
})
const result = (id: string, fields: Partial<ToolResultPart> = {}): ToolResultPart => ({
  type: "tool-result",
  id,
  tool: "shop_orders_list",
  ok: true,
  text: "{}",
  ...fields,
})
const message = (role: Message["role"], parts: Message["parts"]) =>
  new Message({ id: 1, role, parts, context: null, createdAt: DateTime.makeUnsafe(0) })

describe("callStatus", () => {
  it("is running until a result comes, unless it waits for the person", () => {
    const results = new Map([
      ["ok", result("ok")],
      ["bad", result("bad", { ok: false, text: "403" })],
      ["no", result("no", { ok: false, decision: "denied" })],
    ])
    const pending = new Set(["change"])
    expect(callStatus(call("ok"), results, pending)).toEqual({ state: "done" })
    expect(callStatus(call("bad"), results, pending)).toEqual({ state: "failed", reason: "403" })
    expect(callStatus(call("no"), results, pending)).toEqual({ state: "denied" })
    expect(callStatus(call("change", "Refund", true), results, pending)).toEqual({ state: "waiting" })
    expect(callStatus(call("other"), results, pending)).toEqual({ state: "running" })
  })
})

describe("activitySummary", () => {
  it("says what is going on, else what the calls came to", () => {
    expect(activitySummary([call("a"), call("b", "Find pages")], [{ state: "done" }, { state: "running" }])).toBe(
      "Find pages…",
    )
    expect(activitySummary([call("a", "Refund", true)], [{ state: "waiting" }])).toBe("Waiting for your approval")
    expect(activitySummary([call("a")], [{ state: "done" }])).toBe("Find orders")
    expect(
      activitySummary(
        [call("a"), call("b"), call("c")],
        [{ state: "done" }, { state: "failed", reason: "x" }, { state: "denied" }],
      ),
    ).toBe("Used 3 tools, 1 failed, 1 not allowed")
  })
})

describe("liveActivity", () => {
  it("names the call of the last reply still running", () => {
    const messages = [message("assistant", [call("a"), call("b", "Find pages")])]
    expect(liveActivity(messages, resultsOf([message("tool", [result("a")])]))).toBe("Find pages…")
    expect(liveActivity(messages, resultsOf([message("tool", [result("a"), result("b")])]))).toBeUndefined()
    expect(liveActivity([message("user", [{ type: "text", text: "?" }])], new Map())).toBeUndefined()
  })
})

const conversation = (id: string, updated: Date, title = id) =>
  new ConversationSummary({
    id,
    title,
    waitingChanges: 0,
    createdAt: DateTime.makeUnsafe(updated.getTime()),
    updatedAt: DateTime.makeUnsafe(updated.getTime()),
  })

describe("groupByDate", () => {
  it("puts conversations, latest first, under when they were last used", () => {
    const now = new Date(2026, 10, 3, 15, 0)
    const groups = groupByDate(
      [
        conversation("a", new Date(2026, 10, 3, 9, 0)),
        conversation("b", new Date(2026, 10, 2, 23, 0)),
        conversation("c", new Date(2026, 9, 30, 12, 0)),
        conversation("d", new Date(2026, 8, 1, 12, 0)),
      ],
      now,
    )
    expect(groups.map((group) => [group.label, group.conversations.map((each) => each.id)])).toEqual([
      ["Today", ["a"]],
      ["Yesterday", ["b"]],
      ["Last 7 days", ["c"]],
      ["Earlier", ["d"]],
    ])
  })
})

describe("matchingConversations", () => {
  it("keeps the titles with every word of the query", () => {
    const all = [conversation("1", new Date(), "Biggest orders"), conversation("2", new Date(), "Open bugs")]
    expect(matchingConversations(all, "orders BIG").map((each) => each.id)).toEqual(["1"])
    expect(matchingConversations(all, "  ")).toHaveLength(2)
  })
})

describe("conversationItems", () => {
  it("makes one reply of what the assistant wrote until the person wrote again", () => {
    const question = message("user", [{ type: "text", text: "?" }])
    const first = message("assistant", [call("a")])
    const results = message("tool", [result("a")])
    const answer = message("assistant", [{ type: "text", text: "!" }])
    expect(conversationItems([question, first, results, answer, question])).toEqual([
      { kind: "question", message: question },
      { kind: "reply", messages: [first, answer] },
      { kind: "question", message: question },
    ])
  })
})

describe("replyParts", () => {
  it("makes one activity of the calls in a row, across steps, between the texts", () => {
    const parts = replyParts([
      message("assistant", [call("a")]),
      message("assistant", [call("b"), call("c")]),
      message("assistant", [{ type: "text", text: "Found them." }, call("d")]),
      message("assistant", [{ type: "text", text: " " }]),
    ])
    expect(parts.map((part) => (part.kind === "text" ? part.text : part.calls.map((each) => each.id)))).toEqual([
      ["a", "b", "c"],
      "Found them.",
      ["d"],
    ])
  })
})
