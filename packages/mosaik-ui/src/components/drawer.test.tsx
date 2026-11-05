import { render, screen, waitFor } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import * as Drawer from "./drawer"

describe("Drawer.ActionTrigger", () => {
  it("runs the caller's onClick, and closes the drawer", async () => {
    const onClick = vi.fn()
    render(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Title>Title</Drawer.Title>
            <Drawer.ActionTrigger onClick={onClick}>Save</Drawer.ActionTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    ))
    await userEvent.click(await screen.findByRole("button", { name: "Save" }))
    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).toBeNull())
  })
})
