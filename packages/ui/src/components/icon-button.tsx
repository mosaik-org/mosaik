import { cx } from "@mosaik/styled-system/css"
import { type JSX, mergeProps, splitProps } from "solid-js"
import { type ButtonSize, type ButtonVariant, buttonRecipe } from "./button"

export interface IconButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  children: JSX.Element
}

export function IconButton(props: IconButtonProps) {
  const merged = mergeProps(
    { variant: "ghost" as ButtonVariant, size: "md" as ButtonSize, type: "button" as const },
    props,
  )
  const [local, rest] = splitProps(merged, ["label", "variant", "size", "class", "children"])

  return (
    <button
      {...rest}
      class={cx(buttonRecipe({ variant: local.variant, size: local.size, iconOnly: true }), local.class)}
      aria-label={local.label}
      title={local.label}
    >
      {local.children}
    </button>
  )
}
