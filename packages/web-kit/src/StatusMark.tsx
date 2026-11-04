import { usePageStatuses } from "@mosaik/client/solid"
import { Spinner } from "@mosaik/mosaik-ui"
import { css, cva } from "@mosaik/styled-system/css"
import { type Accessor, createMemo, type JSX, Match, Show, Switch } from "solid-js"
import { isQuiet, type StatusSummary, statusesAt, summarize } from "./statusSummary"

const pill = cva({
  base: {
    display: "grid",
    placeItems: "center",
    minW: "5",
    h: "5",
    px: "1.5",
    borderRadius: "full",
    fontSize: "xs",
    fontWeight: "semibold",
    lineHeight: "1",
  },
  variants: {
    tone: {
      attention: { bg: "accent.solid.bg", color: "accent.solid.fg" },
      warning: { bg: "warning.solid.bg", color: "warning.solid.fg" },
      danger: { bg: "danger.solid.bg", color: "danger.solid.fg" },
    },
  },
})

const dot = cva({
  base: { display: "block", width: "2", height: "2", borderRadius: "full", flexShrink: "0" },
  variants: {
    tone: {
      attention: { bg: "accent.solid.bg" },
      warning: { bg: "warning.solid.bg" },
      danger: { bg: "danger.solid.bg" },
    },
  },
})

const styles = {
  mark: css({ display: "inline-flex", alignItems: "center", flexShrink: "0" }),
  // On an icon in the rail: in its corner, apart from the sidebar's background.
  corner: css({
    position: "absolute",
    top: "-1",
    right: "-1",
    display: "grid",
    placeItems: "center",
    borderRadius: "full",
    outline: "2px solid token(colors.gray.2)",
    bg: "gray.2",
  }),
}

/**
 * The one mark beside a place in navigation for what its statuses come to: how many things wait
 * (a number), work running (a spinner), something new or trouble (a dot), in the strongest tone.
 * `corner`: a dot or a spinner on an icon, where there is no room for a number. What each status
 * says is read out with the place, and shows on hover.
 */
export const StatusMark = (props: { readonly summary: StatusSummary; readonly corner?: boolean }): JSX.Element => (
  <Show when={!isQuiet(props.summary)}>
    <span
      class={props.corner === true ? styles.corner : styles.mark}
      title={props.summary.lines.join("\n")}
      data-status-mark
    >
      <Switch fallback={<span class={dot({ tone: props.summary.tone })} />}>
        <Match when={props.summary.count > 0 && props.corner !== true}>
          <span class={pill({ tone: props.summary.tone })} aria-hidden="true">
            {props.summary.count > 99 ? "99+" : props.summary.count}
          </span>
        </Match>
        <Match when={props.summary.running && props.summary.count === 0 && props.summary.tone === "attention"}>
          <Spinner size="xs" />
        </Match>
      </Switch>
      <span class={css({ srOnly: true })}>{props.summary.lines.join(". ")}</span>
    </span>
  </Show>
)

/** What the shell's statuses come to at a path (with `below`, the paths under it too), kept live. */
export const useStatusSummary = (path: Accessor<string>, below: Accessor<boolean>): Accessor<StatusSummary> => {
  const statuses = usePageStatuses()
  return createMemo(() => summarize(statusesAt(statuses(), path(), { below: below() })))
}
