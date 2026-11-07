// @vitest-environment jsdom
import { createRoot, createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { createListNavigation } from "./list-navigation"

const setup = (rows: ReadonlyArray<string>) =>
  createRoot((dispose) => {
    const [items, setItems] = createSignal(rows)
    const changes: Array<string | undefined> = []
    const list = createListNavigation({
      items,
      id: (item) => item,
      label: "Rows",
      initial: rows[0],
      onActiveChange: (id) => changes.push(id),
    })
    return { list, setItems, changes, dispose }
  })

/** Lets effects run: they follow the items once the current batch is over. */
const settled = () => new Promise((resolve) => setTimeout(resolve))

describe("createListNavigation", () => {
  it("moves within the list and stops at its ends", () => {
    const { list, changes, dispose } = setup(["a", "b", "c"])
    list.move(1)
    expect(list.active()).toBe("b")
    list.move(5)
    expect(list.active()).toBe("c")
    list.move(-9)
    expect(list.active()).toBe("a")
    expect(changes).toEqual(["b", "c", "a"])
    dispose()
  })

  it("keeps its place by id when the rows change order", async () => {
    const { list, setItems, dispose } = setup(["a", "b", "c"])
    list.setActive("b")
    setItems(["c", "b", "a", "d"])
    await settled()
    expect(list.active()).toBe("b")
    dispose()
  })

  it("lands on the neighbour when the active row leaves", async () => {
    const { list, setItems, dispose } = setup(["a", "b", "c"])
    list.setActive("b")
    setItems(["a", "b", "c"])
    await settled()
    setItems(["a", "c"])
    await settled()
    expect(list.active()).toBe("c")
    dispose()
  })

  it("lands on the last row when the last one leaves, and on nothing when none are left", async () => {
    const { list, setItems, dispose } = setup(["a", "b"])
    list.setActive("b")
    setItems(["a", "b"])
    await settled()
    setItems(["a"])
    await settled()
    expect(list.active()).toBe("a")
    setItems([])
    await settled()
    expect(list.active()).toBeUndefined()
    dispose()
  })

  it("leaves a row opened from a link alone, though it is not in the list", async () => {
    const { list, setItems, dispose } = setup(["a", "b"])
    list.setActive("elsewhere")
    setItems(["a", "b", "c"])
    await settled()
    expect(list.active()).toBe("elsewhere")
    dispose()
  })

  it("applies actions to the selection if there is one, otherwise to the active row", () => {
    const { list, dispose } = setup(["a", "b", "c"])
    expect(list.targets()).toEqual(["a"])
    list.toggle("b")
    list.toggle("c")
    expect(list.targets()).toEqual(["b", "c"])
    list.toggle("b")
    expect(list.targets()).toEqual(["c"])
    list.clearSelection()
    expect(list.targets()).toEqual(["a"])
    dispose()
  })

  it("extends the selection as it moves", () => {
    const { list, dispose } = setup(["a", "b", "c"])
    list.extend(1)
    list.extend(1)
    expect([...list.selected()]).toEqual(["a", "b", "c"])
    expect(list.active()).toBe("c")
    dispose()
  })

  it("forgets marked rows that left the list", async () => {
    const { list, setItems, dispose } = setup(["a", "b"])
    list.toggle("b")
    setItems(["a"])
    await settled()
    expect(list.selected().size).toBe(0)
    dispose()
  })

  it("leaves a click on a control in a row to that control", () => {
    const { list, dispose } = setup(["a", "b"])
    const eventWith = (target: Element | null) => {
      const event = new MouseEvent("click", { cancelable: true })
      Object.defineProperty(event, "target", { value: target })
      return event
    }
    document.body.innerHTML = '<label data-target><input type="checkbox" /></label><span data-plain></span>'
    const press = eventWith(document.querySelector("[data-target]"))
    list.rowProps("b").onMouseDown(press)
    list.rowProps("b").onClick(press)
    expect(list.active()).toBe("a")
    // Pressing it must not hand focus to the row on the way to the control.
    expect(press.defaultPrevented).toBe(true)
    const plain = eventWith(document.querySelector("[data-plain]"))
    list.rowProps("b").onMouseDown(plain)
    expect(plain.defaultPrevented).toBe(false)
    list.rowProps("b").onClick(plain)
    expect(list.active()).toBe("b")
    dispose()
  })

  it("is one Tab stop: the active row", () => {
    const { list, dispose } = setup(["a", "b"])
    expect(list.rowProps("a").tabIndex).toBe(0)
    expect(list.rowProps("b").tabIndex).toBe(-1)
    list.setActive("b")
    expect(list.rowProps("a").tabIndex).toBe(-1)
    expect(list.rowProps("b").tabIndex).toBe(0)
    dispose()
  })
})
