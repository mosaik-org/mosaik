import { Checkbox as ArkCheckbox } from "@ark-ui/solid/checkbox"
import { sva } from "@mosaik/styled-system/css"
import Check from "lucide-solid/icons/check"
import { children, type JSX, Show } from "solid-js"

const checkbox = sva({
  slots: ["root", "control", "indicator", "text", "label", "description"],
  base: {
    root: {
      display: "inline-flex",
      alignItems: "flex-start",
      gap: "2.5",
      cursor: "pointer",
      _disabled: { cursor: "not-allowed", opacity: "0.6" },
    },
    control: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
      boxSize: "4",
      mt: "0.5",
      bg: "bg.surface",
      color: "accent.fg",
      borderWidth: "1px",
      borderColor: "border.emphasized",
      borderRadius: "sm",
      transitionProperty: "background, border-color",
      transitionDuration: "fast",
      _checked: { bg: "accent.default", borderColor: "accent.default" },
      _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "2px" },
    },
    indicator: { display: "flex", "& svg": { boxSize: "3", strokeWidth: "3" } },
    text: { display: "flex", flexDirection: "column", gap: "0.5" },
    label: { fontSize: "sm", fontWeight: "medium", color: "fg.default" },
    description: { fontSize: "xs", color: "fg.muted" },
  },
})

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: JSX.Element
  description?: JSX.Element
  disabled?: boolean
}

export function Checkbox(props: CheckboxProps) {
  const classes = checkbox()
  const label = children(() => props.label)
  const description = children(() => props.description)

  return (
    <ArkCheckbox.Root
      class={classes.root}
      checked={props.checked}
      onCheckedChange={(details) => props.onCheckedChange(details.checked === true)}
      disabled={props.disabled}
    >
      <ArkCheckbox.Control class={classes.control}>
        <ArkCheckbox.Indicator class={classes.indicator}>
          <Check />
        </ArkCheckbox.Indicator>
      </ArkCheckbox.Control>
      <Show when={label() || description()}>
        <span class={classes.text}>
          <Show when={label()}>
            <ArkCheckbox.Label class={classes.label}>{label()}</ArkCheckbox.Label>
          </Show>
          <Show when={description()}>
            <span class={classes.description}>{description()}</span>
          </Show>
        </span>
      </Show>
      <ArkCheckbox.HiddenInput />
    </ArkCheckbox.Root>
  )
}
