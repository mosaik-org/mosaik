import { describe, expect, it } from "vitest"
import { snoozeChoices, untilLabel } from "./snooze"

// Local times: the choices are in the person's own day.
const friday = new Date(2026, 10, 6, 16, 30) // Friday 6 November, 16:30
const monday = new Date(2026, 10, 9, 8, 0)

const until = (now: Date, id: string) => snoozeChoices(now).find((choice) => choice.id === id)?.until

describe("snoozeChoices", () => {
  it("offers an hour, tomorrow morning and next Monday morning", () => {
    expect(until(friday, "hour")).toEqual(new Date(2026, 10, 6, 17, 30))
    expect(until(friday, "tomorrow")).toEqual(new Date(2026, 10, 7, 9, 0))
    expect(until(friday, "week")).toEqual(new Date(2026, 10, 9, 9, 0))
  })

  it("puts next week a week away when it is Monday already", () => {
    expect(until(monday, "week")).toEqual(new Date(2026, 10, 16, 9, 0))
  })
})

describe("untilLabel", () => {
  const label = (date: Date) => untilLabel(date, friday, "en-GB")

  it("says the time today, the day this week, and the date after", () => {
    expect(label(new Date(2026, 10, 6, 18, 0))).toBe("18:00")
    expect(label(new Date(2026, 10, 7, 9, 0))).toBe("tomorrow 9:00")
    expect(label(new Date(2026, 10, 9, 9, 0))).toBe("Mon 9:00")
    expect(label(new Date(2026, 10, 20, 9, 0))).toBe("20 Nov")
  })
})
