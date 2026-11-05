import { render, screen } from "@solidjs/testing-library"
import userEvent from "@testing-library/user-event"
import { createSignal, For } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { createListCollection } from "../collections"
import * as Command from "./command"
import { Kbd } from "./kbd"

const items = [
  { label: "Orders", value: "orders" },
  { label: "Customers", value: "customers" },
  { label: "Export", value: "export" },
]

/** The list as a caller keeps it: narrowed from what is typed. */
const Palette = (props: { onSelect?: (value: string) => void }) => {
  const [query, setQuery] = createSignal("")
  const found = () =>
    createListCollection({ items: items.filter((item) => item.label.toLowerCase().includes(query().toLowerCase())) })
  return (
    <Command.Root
      collection={found()}
      inputValue={query()}
      onInputValueChange={(details) => setQuery(details.inputValue)}
      onSelect={(details) => props.onSelect?.(details.itemValue)}
    >
      <Command.Label>Commands</Command.Label>
      <Command.Control>
        <Command.Indicator />
        <Command.Input />
      </Command.Control>
      <Command.List>
        <Command.Empty>No results</Command.Empty>
        <For each={found().items}>
          {(item) => (
            <Command.Item item={item}>
              <Command.ItemContent>
                <Command.ItemText>{item.label}</Command.ItemText>
              </Command.ItemContent>
              <Command.ItemCommand>
                <Kbd>K</Kbd>
              </Command.ItemCommand>
            </Command.Item>
          )}
        </For>
      </Command.List>
    </Command.Root>
  )
}

const highlighted = () => document.querySelector("[role=option][data-highlighted]")?.textContent

describe("Command", () => {
  it("lists its items with no need to open anything, the first one ready", () => {
    render(() => <Palette />)
    expect(screen.getAllByRole("option")).toHaveLength(3)
    expect(highlighted()).toContain("Orders")
  })

  it("moves with the arrow keys and runs the item with Enter", async () => {
    const onSelect = vi.fn()
    render(() => <Palette onSelect={onSelect} />)
    await userEvent.click(screen.getByRole("combobox"))
    await userEvent.keyboard("{ArrowDown}")
    expect(highlighted()).toContain("Customers")
    await userEvent.keyboard("{Enter}")
    expect(onSelect).toHaveBeenCalledWith("customers")
  })

  it("keeps its list and what was typed after running an item", async () => {
    render(() => <Palette />)
    const input = screen.getByRole<HTMLInputElement>("combobox")
    await userEvent.type(input, "ord{Enter}")
    expect(input.value).toBe("ord")
    expect(screen.getAllByRole("option")).toHaveLength(1)
  })

  it("starts at the best match as you type, and says when nothing matches", async () => {
    render(() => <Palette />)
    const input = screen.getByRole("combobox")
    await userEvent.type(input, "exp")
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(highlighted()).toContain("Export")
    await userEvent.type(input, "zz")
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(screen.getByText("No results")).toBeTruthy()
  })

  it("names the palette in a dialog, and closes on Escape", async () => {
    const Dialogged = () => {
      const [open, setOpen] = createSignal(true)
      return (
        <Command.Dialog open={open()} onOpenChange={(details) => setOpen(details.open)}>
          <Command.DialogBackdrop />
          <Command.DialogContent>
            <Palette />
          </Command.DialogContent>
        </Command.Dialog>
      )
    }
    render(() => <Dialogged />)
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeTruthy()
    await userEvent.keyboard("{Escape}")
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})
