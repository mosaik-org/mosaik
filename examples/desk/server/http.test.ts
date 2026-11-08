import { describe, expect, layer } from "@effect/vitest"
import { Audiences } from "@mosaik/sdk/server"
import { AppTest, TestAudit, TestEvents, TestNotify, TestSettings, TestStatus } from "@mosaik/sdk/testing"
import { DateTime, Effect, Layer } from "effect"
import { TestClock } from "effect/testing"
import { DeadlineRule, DeskApi, NewReply, NewRequest, type Priority, QueueId, QueueInput, type RequestId } from "../api"
import { desk } from "../manifest"
import { Changes } from "./Changes"
import { Desk } from "./Desk"
import { EventHandlers } from "./events"
import { ApiHandlers } from "./http"
import { Statuses } from "./Statuses"
import { InMemoryPeople, InMemoryRequests, InMemorySetup } from "./stores.memory"
import { Sweep } from "./sweep"

const it_ = QueueId.make(1)
const hr = QueueId.make(2)

const ada = AppTest.user({ id: "ada", name: "Ada", grants: [desk.accessPermission] })
const grace = AppTest.user({ id: "grace", name: "Grace", grants: [desk.accessPermission] })
const lin = AppTest.user({ id: "lin", name: "Lin", grants: [desk.accessPermission, desk.perm("requests.work")] })
const max = AppTest.user({ id: "max", name: "Max", grants: [desk.accessPermission, desk.perm("requests.work")] })
const lead = AppTest.user({
  id: "lead",
  name: "Lea",
  grants: [desk.accessPermission, "desk:requests.*", desk.perm("configure")],
})

const Stores = Layer.mergeAll(InMemoryRequests, InMemoryPeople, InMemorySetup(["IT", "HR"]), Changes.layer)
const Services = Statuses.layer.pipe(Layer.provideMerge(Stores))
const Everything = Sweep.layer.pipe(Layer.provideMerge(Services))

const app = AppTest.layer({
  app: desk,
  api: DeskApi,
  handlers: ApiHandlers.pipe(Layer.provide(Desk.layer), Layer.provideMerge(Everything)) as never,
  events: EventHandlers.pipe(Layer.provide(Services)),
})

const ask = (title = "Laptop will not start", priority: Priority = "normal", queueId = it_) =>
  new NewRequest({ title, body: "It stays black.", queueId, priority })

/** Everyone the tests give requests to has to have opened the desk: it only knows who it has met. */
const meetEveryone = Effect.gen(function* () {
  const api = yield* AppTest.client(DeskApi)
  for (const person of [ada, grace, lin, max, lead]) {
    yield* api.as(person, (client) => client.requests.list({ query: { view: "visible" } }))
  }
})

layer(app as never)("The desk", (it) => {
  describe("who sees what", () => {
    it.effect("someone who asked sees theirs, and no one else's", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const created = yield* api.as(ada, (client) => client.requests.create({ payload: ask("Ada's secret") }))
        const others = yield* api.as(grace, (client) =>
          client.requests.list({ query: { view: "all", search: "secret" } }),
        )
        expect(others.rows).toEqual([])
        const error = yield* Effect.flip(api.as(grace, (client) => client.requests.get({ params: { id: created.id } })))
        expect(error._tag).toBe("NotFound")
        const seen = yield* api.as(lin, (client) => client.requests.get({ params: { id: created.id } }))
        expect(seen.requester.name).toBe("Ada")
      }),
    )

    it.effect("internal notes stay among the people working on it", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(lin, (client) =>
          client.requests.reply({
            params: { id },
            payload: new NewReply({ body: "Between us: it is the third one.", kind: "note" }),
          }),
        )
        const forAgent = yield* api.as(lin, (client) => client.requests.activity({ params: { id } }))
        const forAsker = yield* api.as(ada, (client) => client.requests.activity({ params: { id } }))
        expect(forAgent.map((line) => line.kind)).toEqual(["created", "note"])
        expect(forAsker.map((line) => line.kind)).toEqual(["created"])
      }),
    )

    it.effect("someone who asked cannot add a note", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        const error = yield* Effect.flip(
          api.as(ada, (client) =>
            client.requests.reply({ params: { id }, payload: new NewReply({ body: "Psst", kind: "note" }) }),
          ),
        )
        expect(error._tag).toBe("Conflict")
      }),
    )

    it.effect("the inbox is what is someone's to do: theirs and nobody's, not what waits for an answer", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const titled = (title: string) => api.as(ada, (client) => client.requests.create({ payload: ask(title) }))
        const mine = yield* titled("inbox: mine")
        const others = yield* titled("inbox: someone else's")
        const waiting = yield* titled("inbox: waiting")
        yield* titled("inbox: nobody's")
        yield* api.as(lin, (client) =>
          client.requests.edit({
            payload: {
              edits: [
                { id: mine.id, change: { assigneeId: "lin" } },
                { id: others.id, change: { assigneeId: "max" } },
                { id: waiting.id, change: { assigneeId: "lin", status: "waiting" } },
              ],
            },
          }),
        )
        const inbox = yield* api.as(lin, (client) =>
          client.requests.list({ query: { view: "inbox", search: "inbox:" } }),
        )
        expect(inbox.rows.map((row) => row.title).toSorted()).toEqual(["inbox: mine", "inbox: nobody's"])
      }),
    )
  })

  describe("changing requests", () => {
    it.effect("answers with what undoes it, and undoing puts it back", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        const result = yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "lin", priority: "urgent" } }] } }),
        )
        expect(result.rows[0]).toMatchObject({ status: "open", priority: "urgent" })
        expect(result.rows[0]?.assignee?.name).toBe("Lin")
        const undone = yield* api.as(lin, (client) => client.requests.edit({ payload: { edits: result.undo } }))
        expect(undone.rows[0]).toMatchObject({ status: "new", priority: "normal", assignee: null })
      }),
    )

    it.effect("changes many at once", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const one = yield* api.as(ada, (client) => client.requests.create({ payload: ask("one") }))
        const two = yield* api.as(ada, (client) => client.requests.create({ payload: ask("two") }))
        const result = yield* api.as(lin, (client) =>
          client.requests.edit({
            payload: {
              edits: [
                { id: one.id, change: { queueId: hr } },
                { id: two.id, change: { queueId: hr } },
              ],
            },
          }),
        )
        expect(result.rows.map((row) => row.queueName)).toEqual(["HR", "HR"])
      }),
    )

    it.effect("tells its story in words", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "max", queueId: hr } }] } }),
        )
        const lines = yield* api.as(lin, (client) => client.requests.activity({ params: { id } }))
        expect(lines.filter((line) => line.kind === "change").map((line) => [line.field, line.from, line.to])).toEqual([
          ["queue", "IT", "HR"],
          ["status", "New", "In progress"],
          ["assignee", null, "Max"],
        ])
      }),
    )

    it.effect("adds nothing to its story when nothing moved", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { priority: "normal" } }] } }),
        )
        expect(yield* api.as(lin, (client) => client.requests.activity({ params: { id } }))).toHaveLength(1)
      }),
    )

    it.effect("gives requests only to people who work on them", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        const error = yield* Effect.flip(
          api.as(lin, (client) =>
            client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "grace" } }] } }),
          ),
        )
        expect(error).toMatchObject({ _tag: "BadRequest", message: "That person does not work on requests." })
      }),
    )

    it.effect("lets the person who asked say it is solved, and not much more", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        const refused = yield* Effect.flip(
          api.as(ada, (client) =>
            client.requests.edit({ payload: { edits: [{ id, change: { priority: "urgent" } }] } }),
          ),
        )
        expect(refused._tag).toBe("Conflict")
        const solved = yield* api.as(ada, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { status: "solved" } }] } }),
        )
        expect(solved.rows[0]?.status).toBe("solved")
        const stranger = yield* Effect.flip(
          api.as(grace, (client) =>
            client.requests.edit({ payload: { edits: [{ id, change: { title: "Mine now" } }] } }),
          ),
        )
        expect(stranger._tag).toBe("NotFound")
      }),
    )

    it.effect("tells someone when a request becomes theirs, unless they took it", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask("Tell Max") }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "max" } }] } }),
        )
        yield* api.as(max, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "max" } }] } }),
        )
        const sent = (yield* (yield* TestNotify).sent).filter((one) => one.content.title.includes("Tell Max"))
        expect(sent).toHaveLength(1)
        expect(sent[0]).toMatchObject({
          type: desk.notification("request.assigned"),
          audience: Audiences.users("max" as never),
        })
      }),
    )

    it.effect("resolves what it gave someone once the request is someone else's, or solved", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask("Hand it over") }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "max" } }] } }),
        )
        const [assigned] = (yield* (yield* TestNotify).sent).filter((one) => one.content.title.includes("Hand it over"))
        expect(assigned?.subject).toBe(`request:${id}`)

        yield* api.as(max, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { status: "solved" } }] } }),
        )
        const resolved = (yield* (yield* TestNotify).resolved).filter((one) => one.subject === `request:${id}`)
        // Given to Max (whoever was told before is done with it), then solved by him.
        expect(resolved.map((one) => one.by)).toEqual(["lin", "max"])
      }),
    )

    it.effect("is audited, attributed to whoever did it", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { priority: "high" } }] } }),
        )
        expect(yield* (yield* TestAudit).entries).toContainEqual(
          expect.objectContaining({
            action: "requests.edit",
            target: `REQ-${id}`,
            actor: expect.objectContaining({ id: "lin" }),
          }),
        )
      }),
    )
  })

  describe("replies", () => {
    it.effect("go back and forth, each side hearing of the other's", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask("Back and forth") }))
        const answered = yield* api.as(lin, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "Is it charged?", kind: "reply" }) }),
        )
        expect(answered.status).toBe("waiting")
        expect(answered.assignee?.name).toBe("Lin")
        const asked = yield* api.as(ada, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "It is.", kind: "reply" }) }),
        )
        expect(asked.status).toBe("open")
        const heard = (yield* (yield* TestNotify).sent).filter((one) => one.content.title.includes("Back and forth"))
        expect(heard.map((one) => one.audience)).toEqual([
          Audiences.users("ada" as never),
          Audiences.users("lin" as never),
        ])
      }),
    )

    it.effect("mark what is new for the other side only", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* TestClock.adjust("1 minute")
        yield* api.as(lin, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "Is it charged?", kind: "reply" }) }),
        )
        expect((yield* api.as(ada, (client) => client.requests.get({ params: { id } }))).unread).toBe(true)
        expect((yield* api.as(lin, (client) => client.requests.get({ params: { id } }))).unread).toBe(false)
        yield* TestClock.adjust("1 minute")
        yield* api.as(ada, (client) => client.requests.markRead({ params: { id } }))
        expect((yield* api.as(ada, (client) => client.requests.get({ params: { id } }))).unread).toBe(false)
      }),
    )
  })

  describe("deleting", () => {
    it.effect("is for leads, and for the person who asked until someone picks it up", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const created = (title: string) => api.as(ada, (client) => client.requests.create({ payload: ask(title) }))
        const remove = (person: typeof ada, id: RequestId) =>
          api.as(person, (client) => client.requests.remove({ params: { id } }))

        const fresh = yield* created("taken back")
        yield* remove(ada, fresh.id)
        expect(
          yield* Effect.flip(api.as(lin, (client) => client.requests.get({ params: { id: fresh.id } }))),
        ).toMatchObject({
          _tag: "NotFound",
        })

        const picked = yield* created("picked up")
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id: picked.id, change: { assigneeId: "lin" } }] } }),
        )
        expect((yield* Effect.flip(remove(ada, picked.id)))._tag).toBe("Conflict")
        expect((yield* Effect.flip(remove(lin, picked.id)))._tag).toBe("Conflict")
        yield* remove(lead, picked.id)
      }),
    )
  })

  describe("as time passes", () => {
    it.effect("tells whoever has it once that it is overdue, then again for the next deadline", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask("Overdue one", "urgent") }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "lin" } }] } }),
        )
        const sweep = yield* Sweep
        const told = Effect.map(
          Effect.flatMap(TestNotify, (notify) => notify.sent),
          (sent) => sent.filter((one) => one.content.title === `REQ-${id} is overdue: Overdue one`),
        )
        yield* sweep.run
        expect(yield* told).toHaveLength(0)
        yield* TestClock.adjust("31 minutes")
        yield* sweep.run
        yield* sweep.run
        expect(yield* told).toHaveLength(1)
        expect((yield* told)[0]?.audience).toEqual(Audiences.users("lin" as never))
        // Answered: the deadline that counts now is solving it, and that one passes too.
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { status: "waiting" } }] } }),
        )
        yield* api.as(ada, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "Any news?", kind: "reply" }) }),
        )
        yield* api.as(lin, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "Soon", kind: "reply" }) }),
        )
        yield* api.as(ada, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "Thanks", kind: "reply" }) }),
        )
        yield* TestClock.adjust("5 hours")
        yield* sweep.run
        expect(yield* told).toHaveLength(2)
      }),
    )

    it.effect("closes what has been solved for long enough, by the desk's setting, for good", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        yield* (yield* TestSettings.for(desk)).set("closeAfterDays", 2)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(lin, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { status: "solved" } }] } }),
        )
        const sweep = yield* Sweep
        yield* TestClock.adjust("1 day")
        yield* sweep.run
        expect((yield* api.as(lin, (client) => client.requests.get({ params: { id } }))).status).toBe("solved")
        yield* TestClock.adjust("2 days")
        yield* sweep.run
        expect((yield* api.as(lin, (client) => client.requests.get({ params: { id } }))).status).toBe("closed")
        const reply = yield* Effect.flip(
          api.as(ada, (client) =>
            client.requests.reply({ params: { id }, payload: new NewReply({ body: "Back", kind: "reply" }) }),
          ),
        )
        expect(reply).toMatchObject({ _tag: "Conflict", message: expect.stringContaining("closed") })
        yield* (yield* TestSettings).reset
      }),
    )
  })

  describe("what shows in navigation", () => {
    it.effect("counts what is yours to do, and what waits for your answer", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(max, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "max" } }] } }),
        )
        const status = yield* TestStatus
        expect(yield* status.values("inbox")).toContainEqual({
          audience: { _tag: "user", id: "max" },
          value: { _tag: "count", count: expect.any(Number) },
          link: "/",
        })
        yield* api.as(max, (client) =>
          client.requests.reply({ params: { id }, payload: new NewReply({ body: "Which one?", kind: "reply" }) }),
        )
        expect(yield* status.values("mine")).toContainEqual({
          audience: { _tag: "user", id: "ada" },
          value: { _tag: "count", count: expect.any(Number) },
          link: "/mine",
        })
      }),
    )
  })

  describe("what Mosaik tells it about people", () => {
    it.effect("puts back in the queue what someone can no longer reach", () =>
      Effect.gen(function* () {
        yield* meetEveryone
        const api = yield* AppTest.client(DeskApi)
        const { id } = yield* api.as(ada, (client) => client.requests.create({ payload: ask() }))
        yield* api.as(max, (client) =>
          client.requests.edit({ payload: { edits: [{ id, change: { assigneeId: "max" } }] } }),
        )
        const events = yield* TestEvents
        yield* events.deliver("user.access_changed", {
          userId: "max" as never,
          hasAccess: true,
          grants: [desk.accessPermission],
        })
        const after = yield* api.as(lin, (client) => client.requests.get({ params: { id } }))
        expect(after).toMatchObject({ assignee: null, status: "new" })
        const agents = yield* api.as(lin, (client) => client.directory.agents())
        expect(agents.map((person) => person.id)).not.toContain("max")
      }),
    )
  })

  describe("setup", () => {
    it.effect("is for people who may configure the desk", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const error = yield* Effect.flip(
          api.as(lin, (client) =>
            client.setup.createQueue({ payload: new QueueInput({ name: "Legal", description: "" }) }),
          ),
        )
        expect(error._tag).toBe("Forbidden")
      }),
    )

    it.effect("keeps queue names apart", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const created = yield* api.as(lead, (client) =>
          client.setup.createQueue({ payload: new QueueInput({ name: "Facilities", description: "Desks and doors" }) }),
        )
        expect(created.name).toBe("Facilities")
        const error = yield* Effect.flip(
          api.as(lead, (client) =>
            client.setup.createQueue({ payload: new QueueInput({ name: "IT", description: "" }) }),
          ),
        )
        expect(error).toMatchObject({ _tag: "Conflict", message: "There is a queue called IT already" })
      }),
    )

    it.effect("removes a queue only once no request is in it", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const queue = yield* api.as(lead, (client) =>
          client.setup.createQueue({ payload: new QueueInput({ name: "Legal", description: "" }) }),
        )
        const { id } = yield* api.as(ada, (client) =>
          client.requests.create({ payload: ask("Contract", "normal", queue.id) }),
        )
        const error = yield* Effect.flip(
          api.as(lead, (client) => client.setup.removeQueue({ params: { id: queue.id } })),
        )
        expect(error).toMatchObject({ _tag: "Conflict", message: "1 request is in this queue. Move them first." })
        yield* api.as(lin, (client) => client.requests.edit({ payload: { edits: [{ id, change: { queueId: hr } }] } }))
        yield* api.as(lead, (client) => client.setup.removeQueue({ params: { id: queue.id } }))
        expect((yield* api.as(lin, (client) => client.directory.queues())).map((one) => one.name)).not.toContain(
          "Legal",
        )
      }),
    )

    it.effect("applies new deadlines to requests from now on, and keeps the promises made", () =>
      Effect.gen(function* () {
        const api = yield* AppTest.client(DeskApi)
        const before = yield* api.as(ada, (client) => client.requests.create({ payload: ask("Before", "low") }))
        yield* api.as(lead, (client) =>
          client.setup.setDeadline({
            payload: new DeadlineRule({ priority: "low", respondMinutes: 5, resolveMinutes: 10 }),
          }),
        )
        const after = yield* api.as(ada, (client) => client.requests.create({ payload: ask("After", "low") }))
        const stillBefore = yield* api.as(lin, (client) => client.requests.get({ params: { id: before.id } }))
        expect(DateTime.toEpochMillis(stillBefore.respondBy)).toBe(DateTime.toEpochMillis(before.respondBy))
        expect(DateTime.toEpochMillis(after.respondBy)).toBeLessThan(DateTime.toEpochMillis(before.respondBy))
      }),
    )
  })
})
