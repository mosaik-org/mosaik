import { type Accessor, batch, createEffect, createMemo, createSignal, on } from "solid-js"

export interface ListNavigationOptions<T> {
  readonly items: Accessor<ReadonlyArray<T>>
  /** Rows are followed by this, never by position: a refresh or a removed row does not lose the person's place. */
  readonly id: (item: T) => string
  /** What the list is, for assistive technology. */
  readonly label: string
  readonly initial?: string | undefined
  readonly onActiveChange?: (id: string | undefined) => void
}

export interface ListNavigation<T> {
  /** Where the person is: one row, moved with the keyboard or by clicking. */
  readonly active: Accessor<string | undefined>
  readonly activeItem: Accessor<T | undefined>
  /** Makes a row active; with `focus`, moves focus to it as well. */
  readonly setActive: (id: string | undefined, options?: { readonly focus?: boolean }) => void
  /** Moves the active row by some rows, staying within the list, and focus with it. */
  readonly move: (by: number) => void
  /** Puts focus back on the active row. */
  readonly focus: () => void
  /** What the person has marked, separately from where they are. */
  readonly selected: Accessor<ReadonlySet<string>>
  readonly toggle: (id: string) => void
  /** Marks the active row, moves, and marks the next: Shift with the arrow keys. */
  readonly extend: (by: number) => void
  readonly clearSelection: () => void
  /** What an action applies to: the selection if there is one, otherwise the active row. */
  readonly targets: Accessor<ReadonlyArray<T>>
  /** Spread on the element holding the rows. */
  readonly listProps: {
    readonly role: "grid"
    readonly "aria-label": string
    readonly "aria-multiselectable": true
    readonly ref: (element: HTMLElement) => void
  }
  /** Spread on a row. Inside it, wrap the content in `role="gridcell"`. */
  readonly rowProps: (id: string) => {
    readonly role: "row"
    readonly tabIndex: number
    readonly "aria-selected": boolean
    readonly "data-row-id": string
    readonly "data-active": "" | undefined
    readonly onFocus: () => void
    readonly onMouseDown: (event: MouseEvent) => void
    readonly onClick: (event: MouseEvent) => void
  }
}

/** What takes its own clicks inside a row. */
const ROW_CONTROLS = "a[href], button, input, label, select, textarea, [role=button], [role=checkbox], [role=menuitem]"

const isRowControl = (event: MouseEvent) =>
  event.target instanceof Element && event.target.closest(ROW_CONTROLS) !== null

/**
 * A list people move through by keyboard: one Tab stop, one active row that holds focus, and a selection
 * apart from it. Key the rows by id (`<For each={ids()}>`) rather than by item: a refresh makes new items,
 * and a row made again loses focus.
 *
 * The keys themselves are commands (`useCommands`), so they show in the palette and the shortcuts panel.
 *
 * @example
 * const list = createListNavigation({ items: requests, id: (r) => String(r.id), label: "Requests" })
 * useCommands(() => [
 *   { id: "next", title: "Next", group: "List", keys: ["j", "arrowdown"], repeats: true, unlisted: true, perform: () => list.move(1) },
 * ])
 * <div {...list.listProps}>
 *   <For each={ids()}>{(id) => <div {...list.rowProps(id)}><div role="gridcell">…</div></div>}</For>
 * </div>
 */
export const createListNavigation = <T>(options: ListNavigationOptions<T>): ListNavigation<T> => {
  const [active, setActiveId] = createSignal(options.initial)
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set())
  let list: HTMLElement | undefined
  // Where the active row was, to land on its neighbour once it is gone.
  let lastIndex = -1
  // A row to mark from when the next is clicked with Shift.
  let anchor: string | undefined

  const ids = createMemo(() => options.items().map(options.id))
  const activeItem = createMemo(() => options.items().find((item) => options.id(item) === active()))

  const rowElement = (id: string) => list?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`) ?? undefined

  const focusRow = (id: string) => {
    const row = rowElement(id)
    row?.focus({ preventScroll: true })
    row?.scrollIntoView({ block: "nearest" })
  }

  const hadFocus = () => list?.contains(document.activeElement) === true

  const setActive: ListNavigation<T>["setActive"] = (id, { focus = false } = {}) => {
    if (id !== active()) {
      setActiveId(id)
      options.onActiveChange?.(id)
    }
    if (focus && id !== undefined) focusRow(id)
  }

  const move = (by: number) => {
    const all = ids()
    if (all.length === 0) return
    const current = all.indexOf(active() ?? "")
    const next = current === -1 ? (by > 0 ? 0 : all.length - 1) : Math.min(all.length - 1, Math.max(0, current + by))
    const id = all[next]
    if (id !== undefined) setActive(id, { focus: true })
  }

  const mark = (marked: ReadonlyArray<string>) => setSelected((current) => new Set([...current, ...marked]))

  createEffect(
    on(ids, (all, previous) => {
      const current = active()
      const index = current === undefined ? -1 : all.indexOf(current)
      if (index !== -1) {
        lastIndex = index
      } else if (current !== undefined && previous?.includes(current) === true) {
        // The active row left the list (solved, moved, deleted): on to the one that took its place.
        const refocus = hadFocus() || document.activeElement === document.body
        const neighbour = all[Math.min(lastIndex, all.length - 1)]
        setActive(neighbour, { focus: refocus })
      }
      // What was marked and is gone cannot be acted on any more.
      const present = new Set(all)
      setSelected((marked) => {
        const kept = [...marked].filter((id) => present.has(id))
        return kept.length === marked.size ? marked : new Set(kept)
      })
    }),
  )

  return {
    active,
    activeItem,
    setActive,
    move,
    focus: () => {
      const id = active()
      if (id !== undefined) focusRow(id)
    },
    selected,
    toggle: (id) => {
      anchor = id
      setSelected((current) => {
        const next = new Set(current)
        if (!next.delete(id)) next.add(id)
        return next
      })
    },
    extend: (by) => {
      const from = active()
      batch(() => {
        if (from !== undefined) mark([from])
        move(by)
        const to = active()
        if (to !== undefined) mark([to])
      })
    },
    clearSelection: () => setSelected(new Set<string>()),
    targets: () => {
      const marked = selected()
      if (marked.size > 0) return options.items().filter((item) => marked.has(options.id(item)))
      const item = activeItem()
      return item === undefined ? [] : [item]
    },
    listProps: {
      role: "grid",
      "aria-label": options.label,
      "aria-multiselectable": true,
      ref: (element) => {
        list = element
      },
    },
    rowProps: (id) => ({
      role: "row",
      // One Tab stop: the active row, or the first when none is active yet.
      get tabIndex() {
        const current = active()
        return id === current || ((current === undefined || !ids().includes(current)) && id === ids()[0]) ? 0 : -1
      },
      get "aria-selected"() {
        return selected().has(id)
      },
      "data-row-id": id,
      get "data-active"() {
        return active() === id ? ("" as const) : undefined
      },
      onFocus: () => setActive(id),
      // Pressing what cannot hold focus gives it to the row, which would make it active first.
      onMouseDown: (event) => {
        if (isRowControl(event)) event.preventDefault()
      },
      onClick: (event) => {
        // A control in the row does its own thing: ticking a checkbox is not going to that row.
        if (isRowControl(event)) return
        if (event.shiftKey && anchor !== undefined) {
          const all = ids()
          const [from, to] = [all.indexOf(anchor), all.indexOf(id)]
          mark(all.slice(Math.min(from, to), Math.max(from, to) + 1))
        }
        anchor = id
        setActive(id, { focus: true })
      },
    }),
  }
}
