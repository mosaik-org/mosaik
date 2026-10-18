import { css, cva, cx } from "@mosaik/styled-system/css"
import { type JSX, mergeProps, Show } from "solid-js"

const card = cva({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4",
    minW: "0",
    bg: "bg.surface",
    borderWidth: "1px",
    borderColor: "border.default",
    borderRadius: "card",
    boxShadow: "card",
  },
  variants: {
    padding: {
      none: { p: "0" },
      md: { p: "5" },
    },
  },
  defaultVariants: { padding: "md" },
})

export interface CardProps {
  class?: string
  padding?: "none" | "md"
  children?: JSX.Element
}

export function Card(props: CardProps) {
  const merged = mergeProps({ padding: "md" as const }, props)
  return <div class={cx(card({ padding: merged.padding }), merged.class)}>{merged.children}</div>
}

const styles = {
  header: css({ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "4" }),
  text: css({ display: "flex", flexDirection: "column", gap: "0.5", minW: "0" }),
  title: css({ fontSize: "md", fontWeight: "semibold", color: "fg.default", lineHeight: "tight" }),
  description: css({ fontSize: "sm", color: "fg.muted" }),
  actions: css({ display: "flex", alignItems: "center", gap: "2", flexShrink: "0" }),
}

export interface CardHeaderProps {
  title: JSX.Element
  description?: JSX.Element
  actions?: JSX.Element
}

export function CardHeader(props: CardHeaderProps) {
  return (
    <div class={styles.header}>
      <div class={styles.text}>
        <h3 class={styles.title}>{props.title}</h3>
        <Show when={props.description}>{(description) => <p class={styles.description}>{description()}</p>}</Show>
      </div>
      <Show when={props.actions}>{(actions) => <div class={styles.actions}>{actions()}</div>}</Show>
    </div>
  )
}
