import { Command, createListCollection } from "@mosaik/mosaik-ui"
import { createMemo, createSignal, For, type JSX, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"

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
    createListCollection({
      items: items(),
      itemToValue: (item: PickerItem) => item.value,
      itemToString: (item: PickerItem) => item.label,
    }),
  )

  return (
    <Command.Dialog
      open={request() !== undefined}
      finalFocusEl={() => (returnTo?.isConnected === true ? returnTo : null)}
      onOpenChange={(details) => {
        if (!details.open) setRequest(undefined)
      }}
    >
      <Portal>
        <Command.DialogBackdrop />
        <Command.DialogContent title={request()?.title}>
          <Show when={request()} keyed>
            {(current) => (
              <Command.Root
                collection={collection()}
                defaultHighlightedValue={current.current ?? collection().firstValue}
                inputValue={query()}
                onInputValueChange={(details) => setQuery(details.inputValue)}
                onSelect={(details) => {
                  setRequest(undefined)
                  // Choosing what it already is changes nothing, so nothing should say it did.
                  if (details.itemValue !== current.current) current.onPick(details.itemValue)
                }}
              >
                <Command.Control>
                  <Command.Indicator />
                  <Command.Input placeholder={current.placeholder} autocomplete="off" spellcheck={false} />
                </Command.Control>
                <Command.List>
                  <Command.Empty>Nothing matches</Command.Empty>
                  <For each={items()}>
                    {(item) => (
                      <Command.Item item={item}>
                        <Show when={item.icon}>
                          <Command.ItemIcon>{item.icon}</Command.ItemIcon>
                        </Show>
                        <Command.ItemContent>
                          <Command.ItemText>{item.label}</Command.ItemText>
                          <Show when={item.description}>
                            <Command.ItemDescription>{item.description}</Command.ItemDescription>
                          </Show>
                        </Command.ItemContent>
                        <Show when={item.value === current.current}>
                          <Command.ItemCommand>Current</Command.ItemCommand>
                        </Show>
                      </Command.Item>
                    )}
                  </For>
                </Command.List>
              </Command.Root>
            )}
          </Show>
        </Command.DialogContent>
      </Portal>
    </Command.Dialog>
  )
}
