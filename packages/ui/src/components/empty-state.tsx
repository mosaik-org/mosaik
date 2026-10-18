import { css } from "@mosaik/styled-system/css"
import { type JSX, Show } from "solid-js"

const styles = {
  root: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3",
    py: "12",
    px: "6",
    textAlign: "center",
  }),
  icon: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSize: "12",
    bg: "bg.muted",
    color: "fg.muted",
    borderRadius: "full",
    "& svg": { boxSize: "6" },
  }),
  text: css({ display: "flex", flexDirection: "column", gap: "1", maxW: "md" }),
  title: css({ fontSize: "md", fontWeight: "semibold", color: "fg.default" }),
  description: css({ fontSize: "sm", color: "fg.muted" }),
  action: css({ mt: "2" }),
}

export interface EmptyStateProps {
  icon?: JSX.Element
  title: JSX.Element
  description?: JSX.Element
  action?: JSX.Element
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div class={styles.root}>
      <Show when={props.icon}>
        {(icon) => (
          <div class={styles.icon} aria-hidden="true">
            {icon()}
          </div>
        )}
      </Show>
      <div class={styles.text}>
        <p class={styles.title}>{props.title}</p>
        <Show when={props.description}>{(description) => <p class={styles.description}>{description()}</p>}</Show>
      </div>
      <Show when={props.action}>{(action) => <div class={styles.action}>{action()}</div>}</Show>
    </div>
  )
}
