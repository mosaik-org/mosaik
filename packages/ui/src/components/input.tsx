import { cva, cx } from "@mosaik/styled-system/css"
import { type JSX, splitProps } from "solid-js"

export const inputRecipe = cva({
  base: {
    display: "block",
    w: "full",
    minW: "0",
    h: "9",
    px: "3",
    bg: "bg.surface",
    color: "fg.default",
    fontSize: "sm",
    borderWidth: "1px",
    borderColor: "border.default",
    borderRadius: "control",
    outline: "none",
    transitionProperty: "border-color, box-shadow",
    transitionDuration: "fast",
    _placeholder: { color: "fg.subtle" },
    _hover: { borderColor: "border.emphasized" },
    _focusVisible: {
      borderColor: "accent.default",
      boxShadow: "0 0 0 1px {colors.accent.default}",
    },
    // Only explicit invalid state (Ark Field / aria-invalid): the native `:invalid` would flag
    // every empty required field before the user typed anything.
    "&[data-invalid], &[aria-invalid=true]": {
      borderColor: "danger.default",
      _focusVisible: { borderColor: "danger.default", boxShadow: "0 0 0 1px {colors.danger.default}" },
    },
    _disabled: { opacity: "0.6", cursor: "not-allowed", bg: "bg.subtle" },
  },
  variants: {
    multiline: {
      true: { h: "auto", minH: "20", py: "2", resize: "vertical" },
    },
  },
})

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <input {...rest} class={cx(inputRecipe(), local.class)} />
}

export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <textarea {...rest} class={cx(inputRecipe({ multiline: true }), local.class)} />
}
