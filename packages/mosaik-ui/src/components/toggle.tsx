import { Toggle as ArkToggle } from "@ark-ui/solid/toggle"
import type { ComponentProps } from "solid-js"
import { styled } from "../../styled-system/jsx"
import { button } from "../../styled-system/recipes"

/** A button that stays pressed (`pressed`/`onPressedChange`), styled as a `Button`; `outline` by default. */
export type ToggleProps = ComponentProps<typeof Toggle>
export const Toggle = styled(ArkToggle.Root, button, { defaultProps: { variant: "outline" } })

/** Shows its children while pressed and `fallback` otherwise. */
export const ToggleIndicator = ArkToggle.Indicator
