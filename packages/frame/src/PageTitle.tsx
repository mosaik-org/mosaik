import { css } from "@mosaik/styled-system/css"
import { type JSX, Show } from "solid-js"
import { FrameHeader } from "./FrameHeader"

const styles = {
  title: css({
    display: "flex",
    alignItems: "center",
    gap: "2",
    minW: "0",
    fontSize: "sm",
    fontWeight: "medium",
    color: "fg",
  }),
  text: css({ truncate: true }),
  // From tablets up, in the bar beside the title; on phones, where they would crowd it out, at the
  // top of the page.
  actions: css({ display: "flex", alignItems: "center", gap: "2", ml: "auto", flexShrink: "0", hideBelow: "md" }),
  pageActions: css({ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2", hideFrom: "md" }),
}

/**
 * A page's heading and actions, in the frame's header: for the frame's own pages, as `AppLayout`
 * is for an app's. Every page's title sits in one place, and the page starts with its content.
 * Its actions are built once for each place they can show, one of them hidden.
 */
export const PageTitle = (props: {
  readonly title: JSX.Element
  readonly icon?: JSX.Element
  readonly actions?: JSX.Element
}): JSX.Element => (
  <>
    <FrameHeader>
      <h1 class={styles.title}>
        {props.icon}
        <span class={styles.text}>{props.title}</span>
      </h1>
      <Show when={props.actions}>
        <div class={styles.actions}>{props.actions}</div>
      </Show>
    </FrameHeader>
    <Show when={props.actions}>
      <div class={styles.pageActions}>{props.actions}</div>
    </Show>
  </>
)
