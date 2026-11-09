import { Command, Dialog } from "@mosaik/ui"
import { css } from "@mosaik/web-sdk/css"
import { createMemo, createSignal, For, type JSX, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"

const styles = {
  // As in a command palette: the search field and the list are the whole box.
  content: css({ py: "0", gap: "0", overflow: "hidden" }),
  text: css({ display: "flex", flexDirection: "column", flex: "1", minW: "0", py: "1" }),
  description: css({ textStyle: "xs", color: "fg.muted", truncate: true }),
  current: css({ flexShrink: "0", textStyle: "xs", color: "fg.muted" }),
}

export interface PickerItem {
  readonly value: string
  readonly label: string
  readonly icon?: JSX.Element
  readonly description?: string
}

export interface PickerRequest {
  /** What is being picked, and for what: "Assign REQ-12". */
  readonly title: string
  readonly placeholder: string
  readonly items: ReadonlyArray<PickerItem>
  /** What it is now: marked and highlighted, so Enter leaves it as it is. */
  readonly current?: string | null | undefined
  readonly onPick: (value: string) => void
}

export interface PickerControl {
  readonly open: (request: PickerRequest) => void
}

/**
 * Choosing one thing by typing a few letters of it, the same way from a key and from a click: assign,
 * status, priority, queue, a saved reply. Closing gives focus back to what opened it.
 *
 * A command list in a dialog of its own rather than in `Command.Dialog`, which cannot be told where
 * focus goes back to.
 */
export const Picker = (props: { ref: (control: PickerControl) => void }) => {
  const [request, setRequest] = createSignal<PickerRequest>()
  const [query, setQuery] = createSignal("")
  // Named rather than left to the dialog: a row can be made again while the picker is open.
  let returnTo: HTMLElement | null = null

  onMount(() =>
    props.ref({
      open: (next) => {
        returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setQuery("")
        setRequest(next)
      },
    }),
  )

  const items = createMemo(() => {
    const term = query().trim().toLowerCase()
    const all = request()?.items ?? []
    return term === "" ? all : all.filter((item) => item.label.toLowerCase().includes(term))
  })
  const collection = createMemo(() =>
    Command.createListCollection<PickerItem>({
      items: items(),
      itemToValue: (item) => item.value,
      itemToString: (item) => item.label,
    }),
  )

  return (
    <Dialog.Root
      placement="top"
      open={request() !== undefined}
      finalFocusEl={() => (returnTo?.isConnected === true ? returnTo : null)}
      onOpenChange={(details) => {
        if (!details.open) setRequest(undefined)
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content class={styles.content} aria-label={request()?.title}>
            <Show when={request()} keyed>
              {(current) => (
                <Command.Root
                  collection={collection()}
                  defaultHighlightedValue={current.current ?? collection().firstValue}
                  onSelect={(details) => {
                    setRequest(undefined)
                    // Choosing what it already is changes nothing, so nothing should say it did.
                    if (details.value !== current.current) current.onPick(details.value)
                  }}
                >
                  <Command.Label>{current.title}</Command.Label>
                  <Command.Input
                    placeholder={current.placeholder}
                    value={query()}
                    onInput={(event) => setQuery(event.currentTarget.value)}
                  />
                  <Command.Content>
                    <For each={items()}>
                      {(item) => (
                        <Command.Item item={item}>
                          {item.icon}
                          <span class={styles.text}>
                            <Command.ItemText>{item.label}</Command.ItemText>
                            <Show when={item.description}>
                              <span class={styles.description}>{item.description}</span>
                            </Show>
                          </span>
                          <Show when={item.value === current.current}>
                            <span class={styles.current}>Current</span>
                          </Show>
                        </Command.Item>
                      )}
                    </For>
                  </Command.Content>
                  <Command.Empty>Nothing matches</Command.Empty>
                </Command.Root>
              )}
            </Show>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
