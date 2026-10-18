import { Avatar as ArkAvatar } from "@ark-ui/solid/avatar"
import { sva } from "@mosaik/styled-system/css"
import { createMemo, mergeProps, Show } from "solid-js"

const avatar = sva({
  slots: ["root", "image", "fallback"],
  base: {
    root: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
      overflow: "hidden",
      bg: "accent.subtle",
      color: "accent.text",
      borderRadius: "full",
      fontWeight: "semibold",
      userSelect: "none",
    },
    image: { boxSize: "full", objectFit: "cover" },
    fallback: { lineHeight: "1", textTransform: "uppercase" },
  },
  variants: {
    size: {
      sm: { root: { boxSize: "7", fontSize: "xs" } },
      md: { root: { boxSize: "9", fontSize: "sm" } },
    },
  },
  defaultVariants: { size: "md" },
})

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase() || "?"
}

export interface AvatarProps {
  name: string
  src?: string | null
  size?: "sm" | "md"
}

export function Avatar(props: AvatarProps) {
  const merged = mergeProps({ size: "md" as const }, props)
  const classes = createMemo(() => avatar({ size: merged.size }))

  return (
    <ArkAvatar.Root class={classes().root} title={merged.name}>
      <ArkAvatar.Fallback class={classes().fallback}>{getInitials(merged.name)}</ArkAvatar.Fallback>
      <Show when={merged.src}>
        {(src) => <ArkAvatar.Image class={classes().image} src={src()} alt={merged.name} />}
      </Show>
    </ArkAvatar.Root>
  )
}
