import { Dialog as ArkDialog } from "@ark-ui/solid/dialog"
import { Kbd, Spinner } from "@mosaik/mosaik-ui"
import { css, sva } from "@mosaik/styled-system/css"
import Search from "lucide-solid/icons/search"
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js"
import { Portal } from "solid-js/web"

export interface CommandMenuItem {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  readonly icon?: JSX.Element
  /** Shown on the right, e.g. an app name or a shortcut. */
  readonly hint?: string
  /** What Tab does on this item (e.g. "Search in Sales"); see `onTab`. */
  readonly tabHint?: string
}

export interface CommandMenuGroup {
  readonly id: string
  readonly label: string
  readonly items: ReadonlyArray<CommandMenuItem>
}

export interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  groups: ReadonlyArray<CommandMenuGroup>
  onSelect: (item: CommandMenuItem) => void
  /** Tab on an item that has a `tabHint`. */
  onTab?: (item: CommandMenuItem) => void
  /** What the search is narrowed to, shown before the input. */
  scope?: string
  /** Backspace in an empty search while narrowed. */
  onClearScope?: () => void
  loading?: boolean
  placeholder?: string
  emptyText?: string
}

const menu = sva({
  slots: [
    "backdrop",
    "positioner",
    "content",
    "search",
    "scope",
    "input",
    "list",
    "group",
    "heading",
    "item",
    "icon",
    "text",
    "subtitle",
    "hint",
    "empty",
    "footer",
  ],
  base: {
    // Above everything on the page, the shell's sticky header included, as dialogs are.
    backdrop: {
      position: "fixed",
      inset: "0",
      zIndex: "modal",
      bg: "black.a7",
      backdropFilter: "blur(2px)",
      _open: { animation: "fade-in 120ms ease-out" },
      _closed: { animation: "fade-out 100ms ease-in" },
    },
    positioner: {
      position: "fixed",
      inset: "0",
      zIndex: "modal",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      px: "4",
      pt: { base: "4", sm: "14vh" },
    },
    content: {
      display: "flex",
      flexDirection: "column",
      w: "full",
      maxW: "xl",
      maxH: { base: "calc(100dvh - 2rem)", sm: "60vh" },
      bg: "gray.surface.bg",
      borderRadius: "l3",
      boxShadow: "lg",
      overflow: "hidden",
      outline: "none",
      _open: { animation: "scale-in 120ms ease-out" },
      _closed: { animation: "scale-out 100ms ease-in" },
    },
    search: { display: "flex", alignItems: "center", gap: "3", px: "4", borderBottomWidth: "1px", color: "fg.subtle" },
    scope: {
      flexShrink: "0",
      px: "2",
      py: "0.5",
      borderRadius: "md",
      bg: "accent.subtle.bg",
      color: "accent.plain.fg",
      fontSize: "sm",
      fontWeight: "medium",
      maxW: "40",
      truncate: true,
    },
    input: {
      flex: "1",
      h: "12",
      bg: "transparent",
      color: "fg.default",
      fontSize: "md",
      outline: "none",
      _placeholder: { color: "fg.subtle" },
    },
    list: { overflowY: "auto", p: "2", minH: "0" },
    group: { "& + &": { mt: "2" } },
    heading: { px: "2", py: "1.5", fontSize: "xs", fontWeight: "medium", color: "fg.subtle" },
    item: {
      display: "flex",
      alignItems: "center",
      gap: "3",
      w: "full",
      px: "2",
      py: "2",
      borderRadius: "md",
      textAlign: "start",
      cursor: "pointer",
      color: "fg.default",
      "&[data-active]": { bg: "gray.subtle.bg" },
    },
    icon: { display: "grid", placeItems: "center", w: "5", color: "fg.muted", flexShrink: "0" },
    text: { display: "flex", flexDirection: "column", flex: "1", minW: "0" },
    subtitle: { fontSize: "xs", color: "fg.muted", truncate: true },
    hint: { fontSize: "xs", color: "fg.subtle", flexShrink: "0" },
    empty: { px: "4", py: "10", textAlign: "center", color: "fg.muted" },
    footer: {
      display: "flex",
      flexWrap: "wrap",
      gap: "4",
      px: "4",
      py: "2",
      borderTopWidth: "1px",
      bg: "gray.2",
      fontSize: "xs",
      color: "fg.muted",
    },
  },
})

/**
 * Presentational command palette: a search input with grouped, keyboard-navigable
 * results. Filtering and data loading belong to the caller.
 */
export function CommandMenu(props: CommandMenuProps) {
  const styles = menu()
  const [active, setActive] = createSignal(0)
  const items = createMemo(() => props.groups.flatMap((group) => group.items))
  const listId = "command-menu-list"
  const optionId = (index: number) => `command-menu-option-${index}`

  createEffect(
    on(
      () => props.groups,
      () => setActive(0),
    ),
  )

  const move = (delta: number) => {
    const count = items().length
    if (count === 0) return
    const next = (active() + delta + count) % count
    setActive(next)
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" })
  }

  const select = (index: number) => {
    const item = items()[index]
    if (item) props.onSelect(item)
  }

  const activeItem = () => items()[active()]

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") move(1)
    else if (event.key === "ArrowUp") move(-1)
    else if (event.key === "Enter") select(active())
    else if (event.key === "Tab" && !event.shiftKey && activeItem()?.tabHint !== undefined) {
      const item = activeItem()
      if (item) props.onTab?.(item)
    } else if (event.key === "Backspace" && props.query === "" && props.scope !== undefined) props.onClearScope?.()
    else return
    event.preventDefault()
  }

  const indexOf = (item: CommandMenuItem) => items().indexOf(item)

  return (
    <ArkDialog.Root
      open={props.open}
      onOpenChange={(details) => props.onOpenChange(details.open)}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <ArkDialog.Backdrop class={styles.backdrop} />
        <ArkDialog.Positioner class={styles.positioner}>
          <ArkDialog.Content class={styles.content} aria-label="Command palette">
            <div class={styles.search}>
              <Search size={18} />
              <Show when={props.scope}>{(scope) => <span class={styles.scope}>{scope()}</span>}</Show>
              <input
                class={styles.input}
                value={props.query}
                onInput={(event) => props.onQueryChange(event.currentTarget.value)}
                onKeyDown={onKeyDown}
                placeholder={props.placeholder ?? "Search pages and actions…"}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={items().length > 0 ? optionId(active()) : undefined}
                autocomplete="off"
                spellcheck={false}
              />
              <Show when={props.loading}>
                <Spinner size="sm" />
              </Show>
            </div>
            <div class={styles.list} id={listId} role="listbox">
              <Show
                when={items().length > 0}
                fallback={<div class={styles.empty}>{props.emptyText ?? "No results"}</div>}
              >
                <For each={props.groups}>
                  {(group) => (
                    <Show when={group.items.length > 0}>
                      {/* biome-ignore lint/a11y/useSemanticElements: ARIA listbox groups, not a form fieldset */}
                      <div class={styles.group} role="group" aria-label={group.label}>
                        <div class={styles.heading}>{group.label}</div>
                        <For each={group.items}>
                          {(item) => (
                            // Combobox pattern: focus stays in the input and options are referenced with
                            // aria-activedescendant, so they are intentionally not focusable themselves.
                            // biome-ignore lint/a11y/useFocusableInteractive: see above
                            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by the input
                            <div
                              id={optionId(indexOf(item))}
                              class={styles.item}
                              role="option"
                              aria-selected={indexOf(item) === active()}
                              data-active={indexOf(item) === active() ? "" : undefined}
                              onPointerMove={() => setActive(indexOf(item))}
                              onClick={() => select(indexOf(item))}
                            >
                              <span class={styles.icon}>{item.icon}</span>
                              <span class={styles.text}>
                                <span class={css({ truncate: true })}>{item.title}</span>
                                <Show when={item.subtitle}>
                                  <span class={styles.subtitle}>{item.subtitle}</span>
                                </Show>
                              </span>
                              <Show when={item.hint}>
                                <span class={styles.hint}>{item.hint}</span>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  )}
                </For>
              </Show>
            </div>
            <div class={styles.footer}>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
              </span>
              <span>
                <Kbd>↵</Kbd> open
              </span>
              <span>
                <Kbd>esc</Kbd> close
              </span>
              <Show when={activeItem()?.tabHint}>
                {(hint) => (
                  <span>
                    <Kbd>tab</Kbd> {hint()}
                  </span>
                )}
              </Show>
              <Show when={props.scope !== undefined && props.query === ""}>
                <span>
                  <Kbd>⌫</Kbd> all apps
                </span>
              </Show>
            </div>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  )
}
