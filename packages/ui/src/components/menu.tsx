import { Menu as ArkMenu } from "@ark-ui/solid/menu"
import { css } from "@mosaik/styled-system/css"
import { For, type JSX, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { popoverContentStyles, popoverItemRecipe } from "./popover-styles"

const styles = {
  header: css({
    px: "2",
    py: "1.5",
    mb: "1",
    borderBottomWidth: "1px",
    borderColor: "border.default",
    fontSize: "sm",
  }),
}

export interface MenuItem {
  value: string
  label: string
  icon?: JSX.Element
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

export interface MenuProps {
  trigger: (props: Record<string, unknown>) => JSX.Element
  items: ReadonlyArray<MenuItem>
  header?: JSX.Element
}

export function Menu(props: MenuProps) {
  return (
    <ArkMenu.Root positioning={{ placement: "bottom-end", gutter: 4 }} lazyMount unmountOnExit>
      <ArkMenu.Trigger asChild={(triggerProps) => props.trigger(triggerProps() as Record<string, unknown>)} />
      <Portal>
        <ArkMenu.Positioner>
          <ArkMenu.Content class={popoverContentStyles}>
            <Show when={props.header}>{(header) => <div class={styles.header}>{header()}</div>}</Show>
            <For each={props.items}>
              {(item) => (
                <ArkMenu.Item
                  value={item.value}
                  disabled={item.disabled}
                  onSelect={() => item.onSelect()}
                  class={popoverItemRecipe({ danger: item.danger })}
                >
                  {item.icon}
                  {item.label}
                </ArkMenu.Item>
              )}
            </For>
          </ArkMenu.Content>
        </ArkMenu.Positioner>
      </Portal>
    </ArkMenu.Root>
  )
}
