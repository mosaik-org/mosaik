import { css } from "@mosaik/styled-system/css"
import { type JSX, Show } from "solid-js"

const styles = {
  root: css({
    display: "flex",
    flexDirection: { base: "column", md: "row" },
    alignItems: { base: "flex-start", md: "center" },
    justifyContent: "space-between",
    gap: "4",
  }),
  heading: css({ display: "flex", alignItems: "center", gap: "3", minW: "0" }),
  icon: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: "0",
    boxSize: "10",
    bg: "accent.subtle",
    color: "accent.text",
    borderRadius: "lg",
    "& svg": { boxSize: "5" },
  }),
  text: css({ display: "flex", flexDirection: "column", gap: "0.5", minW: "0" }),
  title: css({ fontSize: "2xl", fontWeight: "semibold", lineHeight: "tight", letterSpacing: "-0.01em" }),
  description: css({ fontSize: "sm", color: "fg.muted" }),
  actions: css({ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2" }),
}

export interface PageHeaderProps {
  title: JSX.Element
  description?: JSX.Element
  actions?: JSX.Element
  icon?: JSX.Element
}

export function PageHeader(props: PageHeaderProps) {
  return (
    <header class={styles.root}>
      <div class={styles.heading}>
        <Show when={props.icon}>
          {(icon) => (
            <div class={styles.icon} aria-hidden="true">
              {icon()}
            </div>
          )}
        </Show>
        <div class={styles.text}>
          <h1 class={styles.title}>{props.title}</h1>
          <Show when={props.description}>{(description) => <p class={styles.description}>{description()}</p>}</Show>
        </div>
      </div>
      <Show when={props.actions}>{(actions) => <div class={styles.actions}>{actions()}</div>}</Show>
    </header>
  )
}
