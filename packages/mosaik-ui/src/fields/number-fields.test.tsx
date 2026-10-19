import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { expectAccessible } from "../../test/axe"
import { NumberField, RangeSliderField, SliderField } from "./number-fields"

describe("NumberField", () => {
  it("gives numbers, and null while empty", async () => {
    const onValueChange = vi.fn()
    render(() => <NumberField label="Quantity" onValueChange={onValueChange} />)
    const input = screen.getByLabelText("Quantity")
    await userEvent.type(input, "12")
    expect(onValueChange).toHaveBeenLastCalledWith(12)
    await userEvent.clear(input)
    expect(onValueChange).toHaveBeenLastCalledWith(null)
  })

  it("steps with the arrow keys within its bounds", async () => {
    const onValueChange = vi.fn()
    render(() => <NumberField label="Quantity" min={1} max={2} defaultValue={1} onValueChange={onValueChange} />)
    const input = screen.getByLabelText("Quantity")
    await userEvent.click(input)
    await userEvent.keyboard("{ArrowUp}{ArrowUp}")
    expect(onValueChange).toHaveBeenLastCalledWith(2)
  })

  it("is accessible", async () => {
    const { container } = render(() => <NumberField label="Amount" helperText="In euros" />)
    await expectAccessible(container)
  })
})

describe("SliderField and RangeSliderField", () => {
  it("give a number as the thumb moves", async () => {
    const onValueChange = vi.fn()
    render(() => <SliderField label="Volume" defaultValue={40} step={10} onValueChange={onValueChange} />)
    screen.getByRole("slider").focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(onValueChange).toHaveBeenLastCalledWith(50)
  })

  it("give a pair as either thumb moves", async () => {
    const onValueChange = vi.fn()
    render(() => <RangeSliderField label="Price" defaultValue={[20, 60]} step={10} onValueChange={onValueChange} />)
    screen.getAllByRole("slider")[0]?.focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(onValueChange).toHaveBeenLastCalledWith([10, 60])
  })

  it("are accessible", async () => {
    const { container } = render(() => (
      <>
        <SliderField label="Volume" defaultValue={40} showValue />
        <RangeSliderField label="Price" defaultValue={[20, 60]} errorText="Too wide" />
      </>
    ))
    await expectAccessible(container)
  })
})
