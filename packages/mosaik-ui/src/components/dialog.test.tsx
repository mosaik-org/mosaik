import { render, screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import * as Dialog from "./dialog"

describe("Dialog.ActionTrigger", () => {
  const setup = (onClick?: () => void) =>
    render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Title</Dialog.Title>
            <form onSubmit={() => onClick?.()}>
              <Dialog.ActionTrigger onClick={onClick}>Save</Dialog.ActionTrigger>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    ))

  it("runs the caller's onClick once, and closes", async () => {
    const onClick = vi.fn()
    setup(onClick)
    await userEvent.click(await screen.findByRole("button", { name: "Save" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).toBeNull())
  })

  it("closes without one", async () => {
    setup()
    await userEvent.click(await screen.findByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).toBeNull())
  })
})
