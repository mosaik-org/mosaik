import { usePageStatuses } from "@mosaik/client/solid"
import { css, cva } from "@mosaik/styled-system/css"
import { Badge, Spinner } from "@mosaik/ui"
import { type Accessor, createMemo, type JSX, Match, Show, Switch } from "solid-js"
import { isQuiet, type StatusSummary, statusesAt, summarize } from "./statusSummary"

/** How a status's count shows: what waits in grey, as other counts; warnings and trouble in their colour. */
const badge = {
  attention: { variant: "subtle", colorPalette: "gray" },
  warning: { variant: "solid", colorPalette: "warning" },
  danger: { variant: "solid", colorPalette: "danger" },
} as const

const dot = cva({
  base: { display: "block", width: "2", height: "2", borderRadius: "full", flexShrink: "0" },
  variants: {
    tone: {
      attention: { bg: "accent.solid" },
      warning: { bg: "warning.solid" },
      danger: { bg: "danger.solid" },
      // Things waiting where there is no room for their number: grey, as that number is.
      counted: { bg: "gray.9" },
    },
  },
})

/** Things waiting, in no particular alarm: what a grey number or dot stands for. */
const counted = (summary: StatusSummary): boolean => summary.count > 0 && summary.tone === "attention"

const styles = {
  mark: css({ display: "inline-flex", alignItems: "center", flexShrink: "0" }),
  // On an icon in the rail: in its corner, cut out of it by a ring of what is behind. A layer and
  // not an outline: a row's highlight is translucent (`--status-mark-tint`), so the ring only
  // matches it painted the same way, over the sidebar's background.
  corner: css({
    position: "absolute",
    top: "-1",
    right: "-1",
    display: "grid",
    placeItems: "center",
    borderRadius: "full",
    isolation: "isolate",
    _before: {
      content: '""',
      position: "absolute",
      inset: "-2px",
      zIndex: "-1",
      borderRadius: "full",
      bg: "bg.subtle",
      backgroundImage: "linear-gradient(var(--status-mark-tint, transparent), var(--status-mark-tint, transparent))",
    },
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
      <Switch
        fallback={
          <span
            class={dot({ tone: counted(props.summary) ? "counted" : props.summary.tone })}
            data-counted={counted(props.summary)}
          />
        }
      >
        <Match when={props.summary.count > 0 && props.corner !== true}>
          <Badge
            size="sm"
            variant={badge[props.summary.tone].variant}
            colorPalette={badge[props.summary.tone].colorPalette}
            aria-hidden="true"
          >
            {props.summary.count > 99 ? "99+" : props.summary.count}
          </Badge>
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
