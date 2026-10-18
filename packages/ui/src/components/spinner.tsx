import { cva, cx, type RecipeVariantProps } from "@mosaik/styled-system/css"
import { mergeProps } from "solid-js"

const spinner = cva({
  base: {
    display: "inline-block",
    flexShrink: "0",
    borderRadius: "full",
    borderStyle: "solid",
    borderColor: "currentColor",
    borderRightColor: "transparent",
    animation: "spin 0.7s linear infinite",
  },
  variants: {
    size: {
      sm: { boxSize: "3.5", borderWidth: "2px" },
      md: { boxSize: "5", borderWidth: "2px" },
      lg: { boxSize: "8", borderWidth: "3px" },
    },
  },
  defaultVariants: { size: "md" },
})

export type SpinnerProps = RecipeVariantProps<typeof spinner> & {
  label?: string
  class?: string
}

export function Spinner(props: SpinnerProps) {
  const merged = mergeProps({ label: "Loading" }, props)
  return <span role="status" aria-label={merged.label} class={cx(spinner({ size: merged.size }), merged.class)} />
}
