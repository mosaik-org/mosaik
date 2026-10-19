import { render, screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { expectAccessible } from "../../test/axe"
import { PasswordField, TextareaField, TextField } from "./text-field"

describe("TextField", () => {
  it("names the input by its label and reports every change", async () => {
    const onValueChange = vi.fn()
    render(() => <TextField label="Email" type="email" onValueChange={onValueChange} />)
    await userEvent.type(screen.getByLabelText("Email"), "ada")
    expect(onValueChange).toHaveBeenLastCalledWith("ada")
    expect(screen.getByLabelText("Email")).toHaveProperty("type", "email")
  })

  it("follows a controlled value", async () => {
    const [value, setValue] = createSignal("first")
    render(() => <TextField label="Name" value={value()} onValueChange={setValue} />)
    const input = screen.getByLabelText("Name") as HTMLInputElement
    expect(input.value).toBe("first")
    setValue("second")
    expect(input.value).toBe("second")
  })

  it("shows the error instead of the help, and marks the input invalid", async () => {
    const [error, setError] = createSignal<string>()
    render(() => <TextField label="Username" helperText="Letters and digits" errorText={error()} />)
    const input = screen.getByLabelText("Username")
    expect(screen.getByText("Letters and digits")).toBeTruthy()
    expect(input.getAttribute("aria-invalid")).toBeNull()

    setError("This username is taken")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(screen.queryByText("Letters and digits")).toBeNull()
    // Ark notices the message with a MutationObserver, so the link follows a moment later.
    const message = screen.getByText("This username is taken")
    await waitFor(() => expect(input.getAttribute("aria-describedby")).toBe(message.id))
  })

  it("passes required, disabled and read-only to the input", () => {
    render(() => (
      <>
        <TextField label="Required" required />
        <TextField label="Disabled" disabled />
        <TextField label="Read-only" readOnly />
      </>
    ))
    expect(screen.getByLabelText(/Required/)).toHaveProperty("required", true)
    expect(screen.getByLabelText("Disabled")).toHaveProperty("disabled", true)
    expect(screen.getByLabelText("Read-only")).toHaveProperty("readOnly", true)
  })

  it("reports leaving the field, for forms that show errors once it was left", async () => {
    const onBlur = vi.fn()
    render(() => <TextField label="Email" onBlur={onBlur} />)
    await userEvent.click(screen.getByLabelText("Email"))
    await userEvent.tab()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it("is accessible with help and with an error", async () => {
    const { container } = render(() => (
      <>
        <TextField label="Email" helperText="We never share it" />
        <TextField label="Username" required errorText="Taken" />
      </>
    ))
    await expectAccessible(container)
  })
})

describe("TextareaField", () => {
  it("names the textarea by its label and reports changes", async () => {
    const onValueChange = vi.fn()
    render(() => <TextareaField label="Notes" onValueChange={onValueChange} />)
    await userEvent.type(screen.getByLabelText("Notes"), "Hi")
    expect(onValueChange).toHaveBeenLastCalledWith("Hi")
  })
})

describe("PasswordField", () => {
  it("hides the password until the eye button shows it", async () => {
    render(() => <PasswordField label="Password" />)
    const input = screen.getByLabelText("Password") as HTMLInputElement
    expect(input.type).toBe("password")
    await userEvent.click(screen.getByRole("button", { name: "Show password" }))
    expect(input.type).toBe("text")
  })

  it("is accessible", async () => {
    const { container } = render(() => <PasswordField label="Password" helperText="At least 8 characters" />)
    await expectAccessible(container)
  })
})
