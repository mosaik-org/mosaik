import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { expectAccessible } from "../../test/axe"
import { DatePickerField, DateRangePickerField, type IsoDateRange } from "./date-fields"

describe("DatePickerField", () => {
  it("shows an ISO date in the locale's format and gives a typed date as ISO", async () => {
    const onValueChange = vi.fn()
    render(() => <DatePickerField label="Due" defaultValue="2026-10-19" onValueChange={onValueChange} inline />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("10/19/2026")
    await userEvent.clear(input)
    await userEvent.type(input, "11/02/2026{Enter}")
    expect(onValueChange).toHaveBeenLastCalledWith("2026-11-02")
  })

  it("gives null when cleared", async () => {
    const [value, setValue] = createSignal<string | null>("2026-10-19")
    render(() => <DatePickerField label="Due" value={value()} onValueChange={setValue} inline />)
    await userEvent.click(screen.getByRole("button", { name: /clear/i }))
    expect(value()).toBeNull()
  })

  it("picks a day in the calendar", async () => {
    const onValueChange = vi.fn()
    render(() => <DatePickerField label="Due" defaultValue="2026-10-19" onValueChange={onValueChange} inline />)
    await userEvent.click(screen.getByRole("button", { name: "Open calendar" }))
    await userEvent.click(screen.getByRole("button", { name: /October 23, 2026/ }))
    expect(onValueChange).toHaveBeenLastCalledWith("2026-10-23")
  })

  it("is accessible", async () => {
    const { container } = render(() => <DatePickerField label="Due" helperText="Any weekday" inline />)
    await expectAccessible(container)
  })
})

describe("DateRangePickerField", () => {
  it("gives both days once the range is complete", async () => {
    const [value, setValue] = createSignal<IsoDateRange | null>(null)
    render(() => <DateRangePickerField label="Period" value={value()} onValueChange={setValue} inline />)
    const [start, end] = screen.getAllByRole("textbox")
    await userEvent.type(start as HTMLElement, "10/01/2026{Enter}")
    expect(value()).toBeNull()
    await userEvent.type(end as HTMLElement, "10/31/2026{Enter}")
    expect(value()).toEqual(["2026-10-01", "2026-10-31"])
  })
})
