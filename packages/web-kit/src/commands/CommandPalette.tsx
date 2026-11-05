import { Badge, Command, createListCollection, Kbd } from "@mosaik/mosaik-ui"
import { css } from "@mosaik/styled-system/css"
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

const scope = css({ flexShrink: "0", maxW: "40", truncate: true })

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
    <Command.Dialog open={props.open} onOpenChange={(details) => props.onOpenChange(details.open)}>
      <Portal>
        <Command.DialogBackdrop />
        <Command.DialogContent>
          <Command.Root
            collection={collection()}
            inputValue={props.query}
            onInputValueChange={(details) => props.onQueryChange(details.inputValue)}
            highlightedValue={highlighted()}
            onHighlightChange={(details) => setHighlighted(details.highlightedValue)}
            onSelect={(details) => {
              const item = items().find((candidate) => candidate.id === details.itemValue)
              if (item !== undefined) props.onSelect(item)
            }}
          >
            <Command.Control>
              <Command.Indicator loading={props.loading} />
              <Show when={props.scope}>
                {(name) => (
                  <Badge size="lg" class={scope}>
                    {name()}
                  </Badge>
                )}
              </Show>
              <Command.Input
                placeholder={props.placeholder ?? "Search pages and actions…"}
                autocomplete="off"
                spellcheck={false}
                onKeyDown={onKeyDown}
              />
            </Command.Control>
            <Command.List ref={list}>
              <Command.Empty>{props.emptyText ?? "No results"}</Command.Empty>
              <For each={props.groups}>
                {(group) => (
                  <Show when={group.items.length > 0}>
                    <Command.ItemGroup>
                      <Command.ItemGroupLabel>{group.label}</Command.ItemGroupLabel>
                      <For each={group.items}>
                        {(item) => (
                          <Command.Item item={item}>
                            <Command.ItemIcon>{item.icon}</Command.ItemIcon>
                            <Command.ItemContent>
                              <Command.ItemText>{item.title}</Command.ItemText>
                              <Show when={item.subtitle}>
                                <Command.ItemDescription>{item.subtitle}</Command.ItemDescription>
                              </Show>
                            </Command.ItemContent>
                            <Show when={item.hint}>
                              <Command.ItemCommand>{item.hint}</Command.ItemCommand>
                            </Show>
                          </Command.Item>
                        )}
                      </For>
                    </Command.ItemGroup>
                  </Show>
                )}
              </For>
            </Command.List>
            <Command.Footer>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
              </span>
              <span>
                <Kbd>↵</Kbd> open
              </span>
              <span>
                <Kbd>esc</Kbd> close
              </span>
              <Show when={active()?.tabHint}>
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
            </Command.Footer>
          </Command.Root>
        </Command.DialogContent>
      </Portal>
    </Command.Dialog>
  )
}
