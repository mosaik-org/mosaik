import { Menu as ArkMenu } from "@ark-ui/solid/menu"
import { css } from "@mosaik/styled-system/css"
import Check from "lucide-solid/icons/check"
import Monitor from "lucide-solid/icons/monitor"
import Moon from "lucide-solid/icons/moon"
import Sun from "lucide-solid/icons/sun"
import { For } from "solid-js"
import { Dynamic, Portal } from "solid-js/web"
import { type Theme, useTheme } from "../theme/theme-provider"
import { IconButton } from "./icon-button"
import { popoverContentStyles, popoverItemRecipe } from "./popover-styles"

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }>

const iconFor = (theme: Theme) => options.find((option) => option.value === theme)?.icon ?? Monitor

const indicator = css({ ms: "auto", "& svg": { color: "accent.default" } })

export function ThemeToggle() {
  const theme = useTheme()

  return (
    <ArkMenu.Root positioning={{ placement: "bottom-end", gutter: 4 }} lazyMount unmountOnExit>
      <ArkMenu.Trigger
        asChild={(triggerProps) => (
          <IconButton {...triggerProps()} label="Change theme">
            <Dynamic component={iconFor(theme.theme())} size={18} />
          </IconButton>
        )}
      />
      <Portal>
        <ArkMenu.Positioner>
          <ArkMenu.Content class={popoverContentStyles}>
            <ArkMenu.RadioItemGroup
              value={theme.theme()}
              onValueChange={(details) => theme.setTheme(details.value as Theme)}
            >
              <For each={options}>
                {(option) => (
                  <ArkMenu.RadioItem value={option.value} class={popoverItemRecipe()}>
                    <Dynamic component={option.icon} />
                    <ArkMenu.ItemText>{option.label}</ArkMenu.ItemText>
                    <ArkMenu.ItemIndicator class={indicator}>
                      <Check />
                    </ArkMenu.ItemIndicator>
                  </ArkMenu.RadioItem>
                )}
              </For>
            </ArkMenu.RadioItemGroup>
          </ArkMenu.Content>
        </ArkMenu.Positioner>
      </Portal>
    </ArkMenu.Root>
  )
}
