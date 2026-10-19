import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { createSignal } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { expectAccessible } from "../../test/axe"
import { IconButton } from "../components/icon-button"
import { ActionMenu } from "./action-menu"
import { ConfirmDialog } from "./confirm-dialog"
import { Modal } from "./modal"

describe("ActionMenu", () => {
  it("opens with its header and runs the chosen action", async () => {
    const onEdit = vi.fn()
    render(() => (
      <ActionMenu
        trigger={(trigger) => (
          <IconButton aria-label="Actions" {...trigger()}>
            …
          </IconButton>
        )}
        header="Ada"
        items={[
          { value: "edit", label: "Edit", onSelect: onEdit },
          { value: "delete", label: "Delete", danger: true, disabled: true, onSelect: () => {} },
        ]}
      />
    ))
    await userEvent.click(screen.getByRole("button", { name: "Actions" }))
    expect(await screen.findByRole("group", { name: "Ada" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Delete" }).getAttribute("aria-disabled")).toBe("true")
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }))
    expect(onEdit).toHaveBeenCalledOnce()
  })
})

describe("Modal", () => {
  it("opens as a named dialog and closes from its close button", async () => {
    const [open, setOpen] = createSignal(true)
    render(() => (
      <Modal open={open()} onOpenChange={setOpen} title="New project" footer={<button type="button">Create</button>}>
        Body
      </Modal>
    ))
    expect(await screen.findByRole("dialog", { name: "New project" })).toBeTruthy()
    await expectAccessible(document.body)
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(open()).toBe(false)
  })
})

describe("ConfirmDialog", () => {
  it("runs the action from its confirm button and cancels from the other", async () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(() => (
      <ConfirmDialog
        open
        title="Delete it?"
        confirmLabel="Delete"
        tone="danger"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    ))
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
})
