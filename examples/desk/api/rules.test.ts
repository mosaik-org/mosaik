import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { DeskRequest, QueueId, RequestId } from "./domain"
import {
  applyChange,
  applyNote,
  applyReply,
  attentionReason,
  changedFields,
  changeProblem,
  deadlineOf,
  deadlinesFor,
  inverseChange,
  nextDue,
  requesterMay,
  shortDuration,
} from "./rules"

const at = (minutes: number) => DateTime.makeUnsafe(Date.UTC(2026, 10, 2, 9, minutes))
const RULE = { respondMinutes: 60, resolveMinutes: 240 }

const request = (overrides: Partial<ConstructorParameters<typeof DeskRequest>[0]> = {}) =>
  new DeskRequest({
    id: RequestId.make(1),
    title: "Laptop will not start",
    body: "It stays black.",
    queueId: QueueId.make(1),
    priority: "normal",
    status: "new",
    requesterId: "ada",
    assigneeId: null,
    createdAt: at(0),
    updatedAt: at(0),
    ...deadlinesFor(at(0), RULE, 0),
    firstRepliedAt: null,
    solvedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    lastActivityAt: at(0),
    lastActivityBy: "ada",
    ...overrides,
  })

describe("applyChange", () => {
  it("moves a new request on when someone picks it up", () => {
    expect(applyChange(request(), { assigneeId: "lin" }, RULE, "lin", at(5)).status).toBe("open")
  })

  it("leaves the status alone when it is said too", () => {
    expect(applyChange(request(), { assigneeId: "lin", status: "new" }, RULE, "lin", at(5)).status).toBe("new")
  })

  it("does not move on a request that is further along", () => {
    const waiting = request({ status: "waiting", pausedAt: at(1), assigneeId: "lin" })
    expect(applyChange(waiting, { assigneeId: "max" }, RULE, "lin", at(5)).status).toBe("waiting")
  })

  it("keeps a promise made unless the priority moves", () => {
    const urgent = { respondMinutes: 10, resolveMinutes: 30 }
    const same = applyChange(request(), { title: "Laptop is dead" }, urgent, "lin", at(5))
    expect(DateTime.toEpochMillis(same.respondBy)).toBe(DateTime.toEpochMillis(request().respondBy))
    const moved = applyChange(request(), { priority: "urgent" }, urgent, "lin", at(5))
    expect(DateTime.toEpochMillis(moved.respondBy)).toBe(DateTime.toEpochMillis(at(10)))
    expect(DateTime.toEpochMillis(moved.resolveBy)).toBe(DateTime.toEpochMillis(at(30)))
  })
})

describe("the clock", () => {
  it("stops while waiting for the person who asked, and moves the deadlines by that long", () => {
    const waiting = applyChange(request(), { status: "waiting" }, RULE, "lin", at(10))
    expect(nextDue(waiting)).toBeUndefined()
    const back = applyChange(waiting, { status: "open" }, RULE, "lin", at(40))
    expect(back.pausedAt).toBeNull()
    expect(back.pausedSeconds).toBe(30 * 60)
    expect(DateTime.toEpochMillis(back.respondBy)).toBe(DateTime.toEpochMillis(at(90)))
  })

  it("counts the time already stopped when a new priority sets new deadlines", () => {
    const back = applyChange(request({ pausedSeconds: 600 }), { priority: "high" }, RULE, "lin", at(40))
    expect(DateTime.toEpochMillis(back.respondBy)).toBe(DateTime.toEpochMillis(at(70)))
  })

  it("keeps running from where it stopped when going from waiting to solved", () => {
    const waiting = applyChange(request(), { status: "waiting" }, RULE, "lin", at(10))
    const solved = applyChange(waiting, { status: "solved" }, RULE, "lin", at(20))
    expect(DateTime.toEpochMillis(solved.pausedAt as DateTime.Utc)).toBe(DateTime.toEpochMillis(at(10)))
    expect(DateTime.toEpochMillis(solved.solvedAt as DateTime.Utc)).toBe(DateTime.toEpochMillis(at(20)))
  })
})

describe("applyReply", () => {
  it("from an agent: counts as the first answer, goes to them, and waits for the person who asked", () => {
    const after = applyReply(request(), { by: "agent", actorId: "lin" }, at(10))
    expect(after.status).toBe("waiting")
    expect(after.assigneeId).toBe("lin")
    expect(DateTime.toEpochMillis(after.firstRepliedAt as DateTime.Utc)).toBe(DateTime.toEpochMillis(at(10)))
  })

  it("from an agent: leaves it with whoever has it", () => {
    expect(applyReply(request({ assigneeId: "max" }), { by: "agent", actorId: "lin" }, at(10)).assigneeId).toBe("max")
  })

  it("from an agent, solving: is solved", () => {
    expect(applyReply(request(), { by: "agent", actorId: "lin", solve: true }, at(10)).status).toBe("solved")
  })

  it("from the person who asked: puts the ball back, and reopens what was solved", () => {
    const solved = applyChange(request(), { status: "solved" }, RULE, "lin", at(10))
    const after = applyReply(solved, { by: "requester", actorId: "ada" }, at(40))
    expect(after.status).toBe("open")
    expect(after.solvedAt).toBeNull()
    expect(after.pausedSeconds).toBe(30 * 60)
    expect(after.firstRepliedAt).toBeNull()
  })
})

describe("applyNote", () => {
  it("changes where it stands in no way, only that something happened", () => {
    const after = applyNote(request({ status: "waiting", pausedAt: at(1) }), "lin", at(9))
    expect(after.status).toBe("waiting")
    expect(after.lastActivityBy).toBe("lin")
  })
})

describe("deadlineOf", () => {
  it("is the first answer until there is one, then solving it", () => {
    expect(deadlineOf(request(), at(0))?.kind).toBe("reply")
    expect(deadlineOf(request({ firstRepliedAt: at(5), status: "open" }), at(5))?.kind).toBe("solve")
  })

  it("is soon under a quarter of the time left, and missed after it", () => {
    expect(deadlineOf(request(), at(30))?.state).toBe("ok")
    expect(deadlineOf(request(), at(50))?.state).toBe("soon")
    expect(deadlineOf(request(), at(61))?.state).toBe("missed")
  })

  it("is nothing while the clock stands still", () => {
    expect(deadlineOf(request({ status: "solved" }), at(90))).toBeUndefined()
  })
})

describe("undoing", () => {
  it("names only what moved, and puts it back", () => {
    const before = request()
    const after = applyChange(before, { assigneeId: "lin", priority: "high" }, RULE, "lin", at(5))
    const undo = inverseChange(before, after)
    expect(undo).toEqual({ priority: "normal", status: "new", assigneeId: null })
    const back = applyChange(after, undo, RULE, "lin", at(6))
    expect(changedFields(before, back)).toEqual([])
  })
})

describe("who may change what", () => {
  it("lets the person who asked change its words and say it is solved, nothing else", () => {
    expect(requesterMay({ title: "New words" })).toBe(true)
    expect(requesterMay({ status: "solved" })).toBe(true)
    expect(requesterMay({ status: "open" })).toBe(false)
    expect(requesterMay({ priority: "urgent" })).toBe(false)
    expect(requesterMay({ assigneeId: "ada" })).toBe(false)
  })

  it("lets nothing change once closed, and nobody close it by hand", () => {
    expect(changeProblem(request({ status: "closed" }), { title: "Again" })).toContain("closed")
    expect(changeProblem(request(), { status: "closed" })).toContain("Solve it")
    expect(changeProblem(request(), { status: "solved" })).toBeUndefined()
  })
})

describe("shortDuration", () => {
  it("says a time left in the fewest words", () => {
    expect(shortDuration(30_000)).toBe("1m")
    expect(shortDuration(12 * 60_000)).toBe("12m")
    expect(shortDuration(-3 * 3_600_000)).toBe("3h")
    expect(shortDuration(2 * 86_400_000)).toBe("2d")
  })
})

describe("attentionReason", () => {
  const taken = { assigneeId: "lin" }

  it("says what is late, and that nobody has it", () => {
    expect(attentionReason(request(), at(0).pipe(DateTime.add({ minutes: 78 })))).toEqual({
      text: "Overdue by 18m: nobody has replied yet. Nobody has it.",
      state: "missed",
    })
  })

  it("says solving is late once someone has replied", () => {
    const replied = request({ ...taken, status: "open", firstRepliedAt: at(5) })
    expect(attentionReason(replied, at(0).pipe(DateTime.add({ minutes: 250 })))).toEqual({
      text: "Overdue by 10m: still not solved.",
      state: "missed",
    })
  })

  it("says what is due soon", () => {
    expect(attentionReason(request(taken), at(50))).toEqual({ text: "Needs a reply in 10m.", state: "soon" })
  })

  it("says nobody has it while there is time", () => {
    expect(attentionReason(request(), at(1))).toEqual({ text: "Nobody has it.", state: "ok" })
  })

  it("says it is urgent when nothing else is wrong", () => {
    expect(attentionReason(request({ ...taken, priority: "urgent" }), at(1))).toEqual({ text: "Urgent.", state: "ok" })
  })

  it("is nothing for a request on track, or with the person who asked", () => {
    expect(attentionReason(request(taken), at(1))).toBeUndefined()
    expect(attentionReason(request({ status: "waiting" }), at(500))).toBeUndefined()
  })
})
