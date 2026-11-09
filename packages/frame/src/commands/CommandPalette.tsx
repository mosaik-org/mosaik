import { css } from "@mosaik/styled-system/css"
import { Badge, Command, createListCollection, Kbd, SearchIcon, Spinner } from "@mosaik/ui"
import { createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js"
import { Portal } from "solid-js/web"

export interface PaletteItem {
  readonly id: string
  readonly title: string
  readonly subtitle?: string
  readonly icon?: JSX.Element
  /** Shown on the right, e.g. an app name or a shortcut. */
  readonly hint?: string
  /** What Tab does on this item (e.g. "Search in Sales"); see `onTab`. */
  readonly tabHint?: string
}

export interface PaletteGroup {
  readonly id: string
  readonly label: string
  readonly items: ReadonlyArray<PaletteItem>
}

export interface CommandPaletteProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly query: string
  readonly onQueryChange: (query: string) => void
  readonly groups: ReadonlyArray<PaletteGroup>
  readonly onSelect: (item: PaletteItem) => void
  /** Tab on an item that has a `tabHint`. */
  readonly onTab?: (item: PaletteItem) => void
  /** What the search is narrowed to, shown before the input. */
  readonly scope?: string | undefined
  /** Backspace in an empty search while narrowed. */
  readonly onClearScope?: () => void
  readonly loading?: boolean
  readonly placeholder?: string | undefined
  readonly emptyText?: string
}

const styles = {
  scope: css({ flexShrink: "0", maxW: "40", truncate: true }),
  // A column of its own, so the text of items with and without an icon lines up.
  icon: css({ display: "grid", placeItems: "center", flexShrink: "0", width: "5", color: "fg.muted" }),
  text: css({ display: "flex", flexDirection: "column", flex: "1", minWidth: "0", py: "1.5" }),
  subtitle: css({ textStyle: "xs", color: "fg.muted", truncate: true }),
  hint: css({ flexShrink: "0", textStyle: "xs", color: "fg.muted" }),
  // What the keys do, under the list: the library's palette has no footer of its own.
  footer: css({
    display: "flex",
    flexWrap: "wrap",
    flexShrink: "0",
    gap: "4",
    px: "4",
    py: "2",
    borderTopWidth: "1px",
    borderColor: "border.muted",
    bg: "bg.subtle",
    textStyle: "xs",
    color: "fg.muted",
  }),
}

/**
 * The palette people open with Ctrl+K: Mosaik's on top of the library's `Command`, narrowing the
 * search to one app with Tab and saying in its footer what the keys do. What it lists is the
 * caller's, as the search spans what the apps offer.
 */
export function CommandPalette(props: CommandPaletteProps) {
  const items = createMemo(() => props.groups.flatMap((group) => group.items))
  const collection = createMemo(() =>
    createListCollection({ items: [...items()], itemToValue: (item) => item.id, itemToString: (item) => item.title }),
  )

  // Ours, and not left to the list: the footer says what Tab does on it, and results arriving from
  // the apps' searches start it again from the top, heading included.
  const [highlighted, setHighlighted] = createSignal<string | null>(null)
  let list: HTMLDivElement | undefined
  createEffect(
    on(
      () => props.groups,
      () => {
        setHighlighted(items()[0]?.id ?? null)
        if (list !== undefined) list.scrollTop = 0
      },
    ),
  )
  const active = () => items().find((item) => item.id === highlighted())

  const onKeyDown = (event: KeyboardEvent) => {
    const item = active()
    if (event.key === "Tab" && !event.shiftKey && item?.tabHint !== undefined) {
      event.preventDefault()
      props.onTab?.(item)
    } else if (event.key === "Backspace" && props.query === "" && props.scope !== undefined) {
      event.preventDefault()
      props.onClearScope?.()
    }
  }

  return (
    <Portal>
      <Command.Dialog open={props.open} onOpenChange={(details) => props.onOpenChange(details.open)}>
        <Command.Root
          collection={collection()}
          highlightedValue={highlighted()}
          onHighlightChange={(details) => setHighlighted(details.highlightedValue)}
          onSelect={(details) => {
            const item = items().find((candidate) => candidate.id === details.value)
            if (item !== undefined) props.onSelect(item)
          }}
        >
          <Command.Label>Search</Command.Label>
          <Command.Input
            // The scope sits between the icon and what is typed, as the start of the query.
            icon={
              <>
                <Show when={props.loading} fallback={<SearchIcon />}>
                  <Spinner size="sm" label="Searching" />
                </Show>
                <Show when={props.scope}>
                  {(name) => (
                    <Badge size="lg" class={styles.scope}>
                      {name()}
                    </Badge>
                  )}
                </Show>
              </>
            }
            placeholder={props.placeholder ?? "Search pages and actions…"}
            value={props.query}
            onInput={(event) => props.onQueryChange(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <Command.Content ref={list}>
            <For each={props.groups}>
              {(group) => (
                <Show when={group.items.length > 0}>
                  <Command.ItemGroup>
                    <Command.ItemGroupLabel>{group.label}</Command.ItemGroupLabel>
                    <For each={group.items}>
                      {(item) => (
                        <Command.Item item={item}>
                          <span class={styles.icon}>{item.icon}</span>
                          <span class={styles.text}>
                            <Command.ItemText>{item.title}</Command.ItemText>
                            <Show when={item.subtitle}>
                              <span class={styles.subtitle}>{item.subtitle}</span>
                            </Show>
                          </span>
                          <Show when={item.hint}>
                            <span class={styles.hint}>{item.hint}</span>
                          </Show>
                        </Command.Item>
                      )}
                    </For>
                  </Command.ItemGroup>
                </Show>
              )}
            </For>
          </Command.Content>
          <Command.Empty>{props.emptyText ?? "No results"}</Command.Empty>
          <div class={styles.footer}>
            <span>
              <Kbd size="sm">↑</Kbd> <Kbd size="sm">↓</Kbd> navigate
            </span>
            <span>
              <Kbd size="sm">↵</Kbd> open
            </span>
            <span>
              <Kbd size="sm">esc</Kbd> close
            </span>
            <Show when={active()?.tabHint}>
              {(hint) => (
                <span>
                  <Kbd size="sm">tab</Kbd> {hint()}
                </span>
              )}
            </Show>
            <Show when={props.scope !== undefined && props.query === ""}>
              <span>
                <Kbd size="sm">⌫</Kbd> all apps
              </span>
            </Show>
          </div>
        </Command.Root>
      </Command.Dialog>
    </Portal>
  )
}
