import { describe, expect, it } from "@effect/vitest"
import { ConversationSummary, Message, type TurnEvent } from "@mosaik/assistant/contract"
import { InternalClient } from "@mosaik/auth/server"
import { Principal, PrincipalUser, UserId } from "@mosaik/core"
import { AppTool, PersonStatus } from "@mosaik/platform/contract"
import { AppCalls, Catalog, type CatalogTool, inputSchema, PersonStatuses } from "@mosaik/tools"
import { DateTime, Effect, Layer, Option, Stream } from "effect"
import { Approvals } from "./Approvals"
import { AssistantConfig } from "./AssistantConfig"
import { pendingCalls } from "./Calls"
import { Conversations, titleOf } from "./Conversations"
import { Model, type PromptMessage, type StepEvent } from "./Model"
import { MAX_STEPS, Turns, toPrompt } from "./Turns"

const ada = new PrincipalUser({ id: UserId.make("u1"), email: "ada@example.com", name: "Ada", image: null })
const principal = new Principal({ user: ada, grants: ["shop:*"] })

const tool = (name: string, method: AppTool["method"], destructive = false): CatalogTool => {
  const appTool = new AppTool({
    name,
    title: `Title of ${name}`,
    description: `Does ${name}`,
    examples: [],
    method,
    path: "/api/shop/orders",
    permission: "shop:view",
    readOnly: method === "GET",
    destructive,
    params: null,
    query: null,
    payload: null,
  })
  return {
    name: `shop_${name.replace(".", "_")}`,
    app: "shop",
    upstream: new URL("http://shop"),
    tool: appTool,
    input: inputSchema(appTool),
    fingerprint: name,
  }
}
const search = tool("orders.search", "GET")
const refund = tool("orders.refund", "POST", true)

/** What waits for Ada: an app's count, and changes this assistant waits for (which turns leave out). */
const waiting = [
  new PersonStatus({
    key: "shop:orders.pending",
    app: "shop",
    description: "Orders waiting for approval",
    kind: "count",
    tone: "attention",
    path: "/shop/orders",
    link: "/shop/orders?status=pending",
    value: { _tag: "count", count: 3 },
    updatedAt: DateTime.makeUnsafe(0),
  }),
  new PersonStatus({
    key: "core:assistant.approvals",
    app: null,
    description: "Changes the assistant is waiting for you to allow",
    kind: "count",
    tone: "attention",
    path: "/assistant",
    link: "/assistant",
    value: { _tag: "count", count: 1 },
    updatedAt: DateTime.makeUnsafe(0),
  }),
]

const text = (value: string): StepEvent => ({ type: "reply", parts: [{ type: "text", text: value }] })
const asks = (id: string, name: string, input: unknown = {}): StepEvent => ({
  type: "reply",
  parts: [{ type: "tool-call", id, tool: name, input: input as never }],
})

/**
 * A conversation with a scripted model (one reply per step), in-memory storage, and apps that
 * answer every call with what was called.
 */
const setup = (replies: ReadonlyArray<StepEvent>, options: { readonly enabled?: boolean } = {}) => {
  const prompts: Array<ReadonlyArray<PromptMessage>> = []
  const called: Array<string> = []
  const stored: Array<Message> = []
  const titles: Array<string> = []
  // The conversation's title: the first message's opening words, as the store would set it.
  let title = ""
  let next = 0

  const model = Layer.succeed(
    Model,
    Model.of({
      label: "fake/model",
      step: ({ messages }) => {
        prompts.push(messages)
        const reply = replies[next++] ?? text("(the script ran out)")
        // A text reply streams its text first, as models do.
        const streamed: ReadonlyArray<StepEvent> =
          reply.type === "reply" && reply.parts[0]?.type === "text"
            ? [{ type: "text", text: reply.parts[0].text }, reply]
            : [reply]
        return Stream.fromIterable(streamed)
      },
      complete: () => Effect.succeed('"Biggest orders."'),
    }),
  )
  const conversations = Layer.succeed(
    Conversations,
    Conversations.of({
      list: () => Effect.succeed([]),
      start: () => Effect.die("unused"),
      find: (userId, id) =>
        Effect.succeed(
          userId === ada.id && id === "c1"
            ? Option.some({
                summary: new ConversationSummary({
                  id,
                  title,
                  waitingChanges: 0,
                  createdAt: DateTime.makeUnsafe(0),
                  updatedAt: DateTime.makeUnsafe(0),
                }),
                messages: [...stored],
              })
            : Option.none(),
        ),
      append: (_, message) =>
        Effect.sync(() => {
          const created = new Message({
            id: stored.length + 1,
            role: message.role,
            parts: message.parts,
            context: message.context ?? null,
            createdAt: DateTime.makeUnsafe(Date.UTC(2026, 10, 2)),
          })
          stored.push(created)
          const first = message.parts[0]
          if (title === "" && message.role === "user" && first?.type === "text") title = titleOf(first.text)
          return created
        }),
      rename: () => Effect.die("unused"),
      retitle: (_, from, to) =>
        Effect.sync(() => {
          if (title !== from) return
          title = to
          titles.push(to)
        }),
      remove: () => Effect.die("unused"),
      setWaiting: () => Effect.die("unused"),
      waitingIn: () => Effect.die("unused"),
    }),
  )
  // Which conversations' waiting changes were counted again, when their turns ended.
  const settled: Array<string> = []
  const approvals = Layer.succeed(
    Approvals,
    Approvals.of({
      settle: (_, conversation) => Effect.sync(() => void settled.push(conversation)),
      recount: () => Effect.void,
    }),
  )
  const catalog = Layer.succeed(Catalog, Catalog.of({ visibleTo: () => Effect.succeed([search, refund]) }))
  const calls = Layer.succeed(
    AppCalls,
    AppCalls.of({
      call: (_, tool, args) =>
        Effect.sync(() => {
          called.push(tool.name)
          return { ok: true, text: `${tool.name} ran with ${JSON.stringify(args)}` }
        }),
    }),
  )
  const config = Layer.succeed(
    AssistantConfig,
    AssistantConfig.of({
      model:
        options.enabled === false
          ? Option.none()
          : Option.some({ provider: "anthropic", model: "fake", apiKey: undefined as never }),
      brand: "Mosaik",
      agentName: "Mosaik assistant",
    }),
  )
  const layer = Turns.layer.pipe(
    Layer.provide([
      model,
      conversations,
      catalog,
      calls,
      config,
      approvals,
      Layer.succeed(PersonStatuses, PersonStatuses.of({ forPrincipal: () => Effect.succeed(waiting) })),
      Layer.succeed(InternalClient, {} as never),
    ]),
  )
  return { layer, prompts, called, stored, titles, settled, rename: (to: string) => (title = to) }
}

const events = (stream: Stream.Stream<TurnEvent>) =>
  Stream.runCollect(stream).pipe(Effect.map((events) => events.map((event) => event.type)))

const context = { app: "shop", path: "/shop/orders/7", title: "Order 7" }

describe("Turns", () => {
  it.effect("streams a reply and stores the person's message and the answer", () => {
    const { layer, prompts, stored } = setup([text("Hello Ada")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      expect(yield* events(yield* turns.send(principal, "c1", { text: "Hi", context }))).toEqual([
        "message",
        "text",
        "message",
        "done",
      ])
      expect(stored.map((message) => message.role)).toEqual(["user", "assistant"])
      // The model reads the page and the date before what the person wrote.
      expect(prompts[0]?.[0]?.parts[0]).toMatchObject({
        text:
          "[Today is 2026-11-02. The person is on Order 7 (/shop/orders/7) in the shop app.]\n" +
          "[Waiting for the person: shop: Orders waiting for approval: 3 (/shop/orders?status=pending).]\n\nHi",
      })
    }).pipe(Effect.provide(layer))
  })

  it.effect("titles the conversation after its first answer, once", () => {
    const { layer, titles } = setup([text("Here they are"), text("Again")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      yield* events(yield* turns.send(principal, "c1", { text: "Biggest orders?", context }))
      yield* events(yield* turns.send(principal, "c1", { text: "And again?", context }))
      // Cleaned of quotes and the final period; not again after the second answer.
      expect(titles).toEqual(["Biggest orders"])
    }).pipe(Effect.provide(layer))
  })

  it.effect("keeps a title the person chose", () => {
    const { layer, titles, rename } = setup([text("Here they are")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      rename("Mine")
      yield* events(yield* turns.send(principal, "c1", { text: "Biggest orders?", context }))
      expect(titles).toEqual([])
    }).pipe(Effect.provide(layer))
  })

  it.effect("tells the model what waits for the person, with their newest question only", () => {
    const { layer, prompts } = setup([text("One"), text("Two")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      yield* events(yield* turns.send(principal, "c1", { text: "Hi", context: null }))
      yield* events(yield* turns.send(principal, "c1", { text: "What now?", context: null }))
      const read = (message: PromptMessage | undefined) =>
        message?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("") ?? ""
      const [first, , second] = prompts[1] ?? []
      expect(read(second)).toContain(
        "[Waiting for the person: shop: Orders waiting for approval: 3 (/shop/orders?status=pending).]",
      )
      // Earlier questions read as they did: the provider's cache of them holds.
      expect(read(first)).not.toContain("Waiting")
      expect(read(second)).not.toContain("assistant is waiting")
    }).pipe(Effect.provide(layer))
  })

  it.effect("answers what needs the person from the platform, not from an app", () => {
    const { layer, called, stored } = setup([asks("w", "what_needs_me"), text("Three orders wait.")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      yield* events(yield* turns.send(principal, "c1", { text: "What needs me?", context: null }))
      expect(called).toEqual([])
      expect(stored[1]?.parts[0]).toMatchObject({ type: "tool-call", title: "What needs me", changes: false })
      expect(stored[2]?.parts[0]).toMatchObject({
        type: "tool-result",
        ok: true,
        text: expect.stringContaining("- shop: Orders waiting for approval: 3 (/shop/orders?status=pending)"),
      })
    }).pipe(Effect.provide(layer))
  })

  it.effect("runs read-only calls at once and goes on", () => {
    const { layer, prompts, called, stored } = setup([asks("a", "shop_orders_search"), text("Found 2")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      expect(yield* events(yield* turns.send(principal, "c1", { text: "Orders?", context }))).toEqual([
        "message",
        "message",
        "message",
        "text",
        "message",
        "done",
      ])
      expect(called).toEqual(["shop_orders_search"])
      expect(stored.map((message) => message.role)).toEqual(["user", "assistant", "tool", "assistant"])
      // The second step saw the result.
      expect(prompts[1]?.at(-1)).toMatchObject({ role: "tool", parts: [{ type: "tool-result", id: "a", ok: true }] })
    }).pipe(Effect.provide(layer))
  })

  it.effect("waits for the person's approval before a change, then runs it", () => {
    const { layer, called, stored, settled } = setup([
      asks("r", "shop_orders_refund", { path: { id: "7" } }),
      text("Refunded"),
    ])
    return Effect.gen(function* () {
      const turns = yield* Turns
      expect(yield* events(yield* turns.send(principal, "c1", { text: "Refund it", context }))).toEqual([
        "message",
        "message",
        "waiting",
      ])
      expect(called).toEqual([])
      expect(pendingCalls(stored)).toMatchObject([
        { id: "r", title: "Title of orders.refund", app: "shop", changes: true, destructive: true },
      ])
      // What waits for the person is counted again when each turn ends.
      expect(settled).toEqual(["c1"])

      expect(
        yield* events(yield* turns.resolve(principal, "c1", [{ type: "decision", call: "r", approve: true }])),
      ).toEqual(["message", "text", "message", "done"])
      expect(called).toEqual(["shop_orders_refund"])
      expect(stored[2]?.parts[0]).toMatchObject({ type: "tool-result", id: "r", ok: true, decision: "approved" })
      expect(pendingCalls(stored)).toEqual([])
      expect(settled).toEqual(["c1", "c1"])
    }).pipe(Effect.provide(layer))
  })

  it.effect("tells the model when the person denies a change", () => {
    const { layer, prompts, called } = setup([asks("r", "shop_orders_refund"), text("Not refunded")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      yield* events(yield* turns.send(principal, "c1", { text: "Refund it", context }))
      yield* events(yield* turns.resolve(principal, "c1", [{ type: "decision", call: "r", approve: false }]))
      expect(called).toEqual([])
      expect(prompts[1]?.at(-1)).toMatchObject({
        role: "tool",
        parts: [{ type: "tool-result", id: "r", ok: false, decision: "denied" }],
      })
    }).pipe(Effect.provide(layer))
  })

  it.effect("waits for the browser to find pages, then goes on with what it found", () => {
    const { layer, prompts, called, stored } = setup([asks("f", "find_pages", { query: "orders" }), text("Here")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      expect(yield* events(yield* turns.send(principal, "c1", { text: "Where are orders?", context }))).toEqual([
        "message",
        "message",
        "waiting",
      ])
      // No app is called: the browser runs it.
      expect(called).toEqual([])
      expect(pendingCalls(stored)).toMatchObject([{ id: "f", title: "Find pages", runsIn: "browser", changes: false }])
      const found = JSON.stringify([{ title: "Orders", group: "Pages", path: "/sales/orders" }])
      const resolved = yield* turns.resolve(principal, "c1", [{ type: "result", call: "f", ok: true, text: found }])
      expect(yield* events(resolved)).toEqual(["message", "text", "message", "done"])
      expect(prompts[1]?.at(-1)).toMatchObject({ role: "tool", parts: [{ id: "f", ok: true, text: found }] })
    }).pipe(Effect.provide(layer))
  })

  it.effect("refuses a decision on a browser tool, and a result for a change", () => {
    const { layer } = setup([
      {
        type: "reply",
        parts: [
          { type: "tool-call", id: "f", tool: "find_pages", input: {} },
          { type: "tool-call", id: "r", tool: "shop_orders_refund", input: {} },
        ],
      },
    ])
    return Effect.gen(function* () {
      const turns = yield* Turns
      yield* events(yield* turns.send(principal, "c1", { text: "Refund it", context }))
      const decided = yield* Effect.flip(
        turns.resolve(principal, "c1", [{ type: "decision", call: "f", approve: true }]),
      )
      expect(decided).toMatchObject({ message: "Call f runs in the browser" })
      const answered = yield* Effect.flip(
        turns.resolve(principal, "c1", [{ type: "result", call: "r", ok: true, text: "done" }]),
      )
      expect(answered).toMatchObject({ message: "Call r waits for the person's decision" })
    }).pipe(Effect.provide(layer))
  })

  it.effect(`stops after ${MAX_STEPS} steps since the person wrote, however many requests the turn took`, () => {
    const replies = Array.from({ length: MAX_STEPS + 1 }, (_, step) => asks(`f${step}`, "find_pages", { query: "x" }))
    const { layer } = setup(replies)
    return Effect.gen(function* () {
      const turns = yield* Turns
      let last = yield* events(yield* turns.send(principal, "c1", { text: "Loop", context }))
      for (let step = 0; step < MAX_STEPS && last.at(-1) === "waiting"; step++) {
        last = yield* events(
          yield* turns.resolve(principal, "c1", [{ type: "result", call: `f${step}`, ok: true, text: "[]" }]),
        )
      }
      expect(last.at(-1)).toBe("failed")
    }).pipe(Effect.provide(layer))
  })

  it.effect("denies calls left undecided when the person writes again", () => {
    const { layer, called, stored } = setup([asks("r", "shop_orders_refund"), text("OK")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      yield* events(yield* turns.send(principal, "c1", { text: "Refund it", context }))
      yield* events(yield* turns.send(principal, "c1", { text: "Never mind", context }))
      expect(called).toEqual([])
      expect(stored.map((message) => message.role)).toEqual(["user", "assistant", "tool", "user", "assistant"])
      expect(stored[2]?.parts[0]).toMatchObject({ decision: "denied" })
    }).pipe(Effect.provide(layer))
  })

  it.effect("refuses decisions on calls that do not wait for one, and other people's conversations", () => {
    const { layer } = setup([text("Hi")])
    return Effect.gen(function* () {
      const turns = yield* Turns
      const unknown = yield* Effect.flip(
        turns.resolve(principal, "c1", [{ type: "decision", call: "nope", approve: true }]),
      )
      expect(unknown).toMatchObject({ _tag: "BadRequest", message: "No call nope waits to be resolved" })
      const missing = yield* Effect.flip(turns.send(principal, "other", { text: "Hi", context }))
      expect(missing._tag).toBe("NotFound")
    }).pipe(Effect.provide(layer))
  })

  it.effect("refuses turns while no model is set up", () => {
    const { layer } = setup([], { enabled: false })
    return Effect.gen(function* () {
      const turns = yield* Turns
      const off = yield* Effect.flip(turns.send(principal, "c1", { text: "Hi", context }))
      expect(off).toMatchObject({ _tag: "BadRequest", message: "The assistant is off" })
    }).pipe(Effect.provide(layer))
  })
})

describe("toPrompt", () => {
  it("passes the assistant's and tools' parts on unchanged", () => {
    const reply = new Message({
      id: 1,
      role: "assistant",
      parts: [{ type: "reasoning", text: "Think", providerOptions: { a: 1 } }],
      context: null,
      createdAt: DateTime.makeUnsafe(0),
    })
    expect(toPrompt([reply])).toEqual([{ role: "assistant", parts: reply.parts }])
  })
})
