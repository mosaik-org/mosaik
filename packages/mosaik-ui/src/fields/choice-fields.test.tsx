import { render, screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { expectAccessible } from "../../test/axe"
import { CheckboxField, ComboboxField, RadioGroupField, SelectField, SwitchField } from "./choice-fields"

const statuses = [
  { label: "Open", value: "open" },
  { label: "Closed", value: "closed" },
  { label: "Archived", value: "archived", disabled: true },
]

describe("SelectField", () => {
  it("names the trigger by its label and gives the chosen value", async () => {
    const onValueChange = vi.fn()
    render(() => <SelectField label="Status" items={statuses} onValueChange={onValueChange} inline />)
    await userEvent.click(screen.getByRole("combobox", { name: "Status" }))
    await userEvent.click(await screen.findByRole("option", { name: "Closed" }))
    expect(onValueChange).toHaveBeenLastCalledWith("closed")
  })

  it("shows a controlled value and clears it to null", async () => {
    const [value, setValue] = createSignal<string | null>("open")
    render(() => (
      <SelectField label="Status" items={statuses} value={value()} onValueChange={setValue} clearable inline />
    ))
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain("Open")
    await userEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(value()).toBeNull()
  })

  it("takes plain strings as choices", async () => {
    const onValueChange = vi.fn()
    render(() => <SelectField label="Size" items={["S", "M", "L"]} onValueChange={onValueChange} inline />)
    await userEvent.click(screen.getByRole("combobox", { name: "Size" }))
    await userEvent.click(await screen.findByRole("option", { name: "M" }))
    expect(onValueChange).toHaveBeenLastCalledWith("M")
  })

  it("does not offer a disabled choice", async () => {
    render(() => <SelectField label="Status" items={statuses} inline />)
    await userEvent.click(screen.getByRole("combobox", { name: "Status" }))
    expect((await screen.findByRole("option", { name: "Archived" })).getAttribute("aria-disabled")).toBe("true")
  })

  it("is accessible", async () => {
    const { container } = render(() => (
      <SelectField label="Status" items={statuses} errorText="Pick a status" placeholder="Choose" inline />
    ))
    await expectAccessible(container)
  })
})

describe("ComboboxField", () => {
  it("filters the choices by what is typed, ignoring case", async () => {
    const onValueChange = vi.fn()
    render(() => (
      <ComboboxField label="Country" items={["Austria", "Belgium", "Poland"]} onValueChange={onValueChange} inline />
    ))
    await userEvent.type(screen.getByRole("combobox", { name: "Country" }), "pol")
    await waitFor(() => expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Poland"]))
    await userEvent.click(screen.getByRole("option", { name: "Poland" }))
    expect(onValueChange).toHaveBeenLastCalledWith("Poland")
  })
})

describe("RadioGroupField", () => {
  it("gives the chosen value and moves with the arrow keys", async () => {
    const onValueChange = vi.fn()
    render(() => (
      <RadioGroupField label="Plan" items={["Free", "Team"]} defaultValue="Free" onValueChange={onValueChange} />
    ))
    expect(screen.getByRole("group", { name: "Plan" })).toBeTruthy()
    await userEvent.click(screen.getByText("Team"))
    expect(onValueChange).toHaveBeenLastCalledWith("Team")
  })

  it("is accessible", async () => {
    const { container } = render(() => (
      <RadioGroupField label="Plan" items={["Free", "Team"]} errorText="Pick a plan" />
    ))
    await expectAccessible(container)
  })
})

describe("CheckboxField and SwitchField", () => {
  it("give a boolean when their label is clicked", async () => {
    const onCheckbox = vi.fn()
    const onSwitch = vi.fn()
    render(() => (
      <>
        <CheckboxField label="I accept the terms" onCheckedChange={onCheckbox} />
        <SwitchField label="Email me" onCheckedChange={onSwitch} />
      </>
    ))
    await userEvent.click(screen.getByText("I accept the terms"))
    await userEvent.click(screen.getByText("Email me"))
    expect(onCheckbox).toHaveBeenLastCalledWith(true)
    expect(onSwitch).toHaveBeenLastCalledWith(true)
    expect(screen.getByLabelText("I accept the terms")).toHaveProperty("checked", true)
  })

  it("show their error and are accessible", async () => {
    const { container } = render(() => (
      <>
        <CheckboxField label="I accept the terms" errorText="Accept the terms" />
        <SwitchField label="Email me" helperText="Once a day" />
      </>
    ))
    expect(screen.getByLabelText("I accept the terms").getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByText("Accept the terms")).toBeTruthy()
    await expectAccessible(container)
  })
})
