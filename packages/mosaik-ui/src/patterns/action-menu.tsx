import { For, type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"
import * as Menu from "../components/menu"

export interface ActionMenuItem {
  readonly value: string
  readonly label: string
  readonly icon?: JSX.Element
  /** Destroys something: shown in the danger color. */
  readonly danger?: boolean
  readonly disabled?: boolean
  readonly onSelect: () => void
}

export interface ActionMenuProps {
  /** The button that opens it, with the trigger's props spread: `(trigger) => <IconButton {...trigger()} />`. */
  readonly trigger: (trigger: () => JSX.HTMLAttributes<HTMLButtonElement>) => JSX.Element
  readonly items: ReadonlyArray<ActionMenuItem>
  /** Above the items, such as whose actions they are. */
  readonly header?: JSX.Element
  /** Under the header, above the items: choices made in the menu, such as `ThemeChoice`. */
  readonly children?: JSX.Element
}

/** A list of actions behind a button, such as a table row's "…" menu. */
export const ActionMenu = (props: ActionMenuProps) => (
  <Menu.Root positioning={{ placement: "bottom-end" }}>
    <Menu.Trigger asChild={(trigger) => props.trigger(trigger)} />
    <Portal>
      <Menu.Positioner>
        <Menu.Content>
          {/* One group, so the header labels the items for assistive technology too. */}
          <Menu.ItemGroup>
            <Show when={props.header}>
              <Menu.ItemGroupLabel>{props.header}</Menu.ItemGroupLabel>
            </Show>
            <Show when={props.children}>
              {props.children}
              <Menu.Separator />
            </Show>
            <For each={props.items}>
              {(item) => (
                <Menu.Item
                  value={item.value}
                  disabled={item.disabled}
                  data-danger={item.danger ? "" : undefined}
                  onSelect={() => item.onSelect()}
                >
                  {item.icon}
                  {item.label}
                </Menu.Item>
              )}
            </For>
          </Menu.ItemGroup>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  </Menu.Root>
)
