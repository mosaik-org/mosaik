import { render, screen } from "@solidjs/testing-library"
import { describe, expect, it } from "vitest"
import { Input } from "../components/input"
import { InputGroup } from "../components/input-group"
import { TextField } from "./text-field"

describe("FormField", () => {
  it("marks an error with an icon as well as its color", () => {
    render(() => <TextField label="Email" errorText="Enter an address" />)
    expect(screen.getByText("Enter an address").querySelector("svg")).toBeTruthy()
  })

  it("draws no empty error when only marked invalid", () => {
    const { container } = render(() => <TextField label="Email" invalid />)
    expect(container.querySelector("[data-part=error-text]")).toBeNull()
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true")
  })

  it("puts the label beside the control when asked", () => {
    const { container } = render(() => <TextField label="Email" layout="horizontal" />)
    expect(container.querySelector("[data-part=root]")?.className).toContain("orientation_horizontal")
  })
})

describe("InputGroup", () => {
  const classOf = () => screen.getByRole("textbox").className

  it("gives the input inside its size, so that the two cannot disagree", () => {
    render(() => (
      <InputGroup size="lg" startElement="€">
        <Input aria-label="Price" />
      </InputGroup>
    ))
    expect(classOf()).toContain("size_lg")
  })

  it("lets an input choose its own", () => {
    render(() => (
      <InputGroup size="lg">
        <Input aria-label="Price" size="sm" />
      </InputGroup>
    ))
    expect(classOf()).toContain("size_sm")
  })
})
