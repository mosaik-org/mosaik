import { Switch as ArkSwitch } from "@ark-ui/solid/switch"
import { sva } from "@mosaik/styled-system/css"
import { type JSX, Show } from "solid-js"

const switchStyles = sva({
  slots: ["root", "control", "thumb", "label"],
  base: {
    root: {
      display: "inline-flex",
      alignItems: "center",
      gap: "2.5",
      cursor: "pointer",
      _disabled: { cursor: "not-allowed", opacity: "0.6" },
    },
    control: {
      display: "inline-flex",
      alignItems: "center",
      flexShrink: "0",
      w: "9",
      h: "5",
      p: "0.5",
      bg: "bg.emphasized",
      borderRadius: "full",
      transition: "background 150ms",
      _checked: { bg: "accent.default" },
      _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "2px" },
    },
    thumb: {
      boxSize: "4",
      bg: "white",
      borderRadius: "full",
      boxShadow: "sm",
      transition: "transform 150ms",
      _checked: { transform: "translateX(16px)" },
    },
    label: { fontSize: "sm", fontWeight: "medium", color: "fg.default" },
  },
})

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: JSX.Element
  disabled?: boolean
}

export function Switch(props: SwitchProps) {
  const classes = switchStyles()

  return (
    <ArkSwitch.Root
      class={classes.root}
      checked={props.checked}
      onCheckedChange={(details) => props.onCheckedChange(details.checked)}
      disabled={props.disabled}
    >
      <ArkSwitch.Control class={classes.control}>
        <ArkSwitch.Thumb class={classes.thumb} />
      </ArkSwitch.Control>
      <Show when={props.label}>{(label) => <ArkSwitch.Label class={classes.label}>{label()}</ArkSwitch.Label>}</Show>
      <ArkSwitch.HiddenInput />
    </ArkSwitch.Root>
  )
}
