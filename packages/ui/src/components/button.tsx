import { cva, cx } from "@mosaik/styled-system/css"
import { type JSX, mergeProps, Show, splitProps } from "solid-js"
import { Spinner } from "./spinner"

export type ButtonVariant = "solid" | "outline" | "ghost" | "danger"
export type ButtonSize = "sm" | "md"

export const buttonRecipe = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "2",
    flexShrink: "0",
    borderRadius: "control",
    borderWidth: "1px",
    borderColor: "transparent",
    fontWeight: "medium",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
    transitionProperty: "background, border-color, color, box-shadow",
    transitionDuration: "fast",
    outline: "none",
    _focusVisible: { outline: "2px solid", outlineColor: "accent.default", outlineOffset: "2px" },
    _disabled: { opacity: "0.5", cursor: "not-allowed" },
    "& svg": { flexShrink: "0" },
  },
  variants: {
    variant: {
      solid: {
        bg: "accent.default",
        color: "accent.fg",
        _hover: { _enabled: { bg: "accent.emphasized" } },
      },
      outline: {
        bg: "bg.surface",
        color: "fg.default",
        borderColor: "border.default",
        _hover: { _enabled: { bg: "bg.subtle", borderColor: "border.emphasized" } },
      },
      ghost: {
        bg: "transparent",
        color: "fg.muted",
        _hover: { _enabled: { bg: "bg.muted", color: "fg.default" } },
        _expanded: { bg: "bg.muted", color: "fg.default" },
      },
      danger: {
        bg: "danger.default",
        color: "white",
        _hover: { _enabled: { bg: "danger.emphasized" } },
      },
    },
    size: {
      sm: { h: "8", px: "3", fontSize: "sm" },
      md: { h: "9", px: "4", fontSize: "sm" },
    },
    iconOnly: {
      true: { px: "0" },
    },
  },
  compoundVariants: [
    { iconOnly: true, size: "sm", css: { w: "8" } },
    { iconOnly: true, size: "md", css: { w: "9" } },
  ],
  defaultVariants: { variant: "solid", size: "md" },
})

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button(props: ButtonProps) {
  const merged = mergeProps(
    { variant: "solid" as ButtonVariant, size: "md" as ButtonSize, type: "button" as const },
    props,
  )
  const [local, rest] = splitProps(merged, ["variant", "size", "loading", "disabled", "class", "children"])

  return (
    <button
      {...rest}
      class={cx(buttonRecipe({ variant: local.variant, size: local.size }), local.class)}
      disabled={local.disabled || local.loading}
      aria-busy={local.loading || undefined}
    >
      <Show when={local.loading}>
        <Spinner size="sm" />
      </Show>
      {local.children}
    </button>
  )
}
