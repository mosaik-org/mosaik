import { type DateInput, formatDateTime, formatRelativeTime } from "@mosaik/client"
import { useNow } from "@mosaik/client/solid"
import { isFresh } from "@mosaik/core"
import { IconButton, Tooltip } from "@mosaik/mosaik-ui"
import { css, cva } from "@mosaik/styled-system/css"
import { DateTime, type Duration } from "effect"
import RefreshCw from "lucide-solid/icons/refresh-cw"
import { createMemo, type JSX, Show } from "solid-js"
import { freshnessState } from "./freshness-state"

export interface FreshnessProps {
  /** When the data was produced. */
  readonly at: DateInput | undefined
  /** Where the data comes from, shown in the tooltip. */
  readonly source?: string
  /** Data older than this is shown as stale (amber from half of it). Defaults to 5 minutes. */
  readonly staleAfter?: Duration.Input
  /** A live stream is connected (e.g. Server-Sent Events). */
  readonly live?: boolean
  readonly fetching?: boolean
  readonly onRefresh?: () => void
}

const toMillis = (input: DateInput): number =>
  DateTime.isDateTime(input) ? DateTime.toEpochMillis(input) : new Date(input).getTime()

const dot = cva({
  base: { width: "2", height: "2", borderRadius: "full", flexShrink: "0" },
  variants: {
    state: {
      fresh: { bg: "success.solid.bg" },
      aging: { bg: "warning.solid.bg" },
      stale: { bg: "danger.solid.bg" },
      unknown: { bg: "fg.subtle" },
    },
    live: { true: { animation: "fade-in 1s ease-in-out infinite alternate" } },
  },
})

const styles = {
  root: css({ display: "inline-flex", alignItems: "center", gap: "2", fontSize: "xs", color: "fg.muted" }),
  label: css({ whiteSpace: "nowrap", cursor: "default" }),
  spinning: css({ animation: "spin 1s linear infinite" }),
}

/**
 * "Updated 2 min ago" with a colored dot (fresh / aging / stale), the exact time and
 * source in a tooltip, and an optional refresh button.
 */
export const Freshness = (props: FreshnessProps) => {
  const now = useNow()
  const at = createMemo(() => (props.at === undefined ? undefined : toMillis(props.at)))
  const age = () => {
    const time = at()
    return time === undefined ? undefined : Math.max(0, now() - time)
  }
  const state = () => freshnessState(age(), props.staleAfter ?? "5 minutes")

  const label = (): string => {
    const time = at()
    const elapsed = age()
    const relative =
      time === undefined || elapsed === undefined
        ? undefined
        : elapsed < 10_000
          ? "just now"
          : formatRelativeTime(time, now())
    if (props.live) return relative ? `Live · ${relative}` : "Live"
    return relative ? `Updated ${relative}` : "Not loaded yet"
  }

  const details = (): JSX.Element => (
    <div class={css({ display: "flex", flexDirection: "column", gap: "0.5" })}>
      <span>{at() === undefined ? "No data yet" : `Data as of ${formatDateTime(at() ?? 0)}`}</span>
      <Show when={props.source}>{(source) => <span>Source: {source()}</span>}</Show>
      <Show when={state() === "stale"}>
        <span>This data may be out of date.</span>
      </Show>
    </div>
  )

  return (
    <div class={styles.root} data-state={state()}>
      <span class={dot({ state: props.live ? "fresh" : state(), live: props.live ?? false })} aria-hidden="true" />
      <Tooltip content={details()}>
        <span class={styles.label}>{label()}</span>
      </Tooltip>
      <Show when={props.onRefresh}>
        {(refresh) => (
          <IconButton
            variant="plain"
            aria-label="Refresh"
            size="xs"
            disabled={props.fetching}
            onClick={() => refresh()()}
          >
            <RefreshCw size={14} class={props.fetching ? styles.spinning : undefined} />
          </IconButton>
        )}
      </Show>
    </div>
  )
}

/** The parts of a TanStack query result {@link QueryFreshness} needs. */
export interface FreshnessQuery {
  readonly data: unknown
  readonly dataUpdatedAt: number
  readonly isFetching: boolean
  refetch(): unknown
}

/**
 * {@link Freshness} for a query: uses the source time of `Fresh` responses
 * (`asOf`), otherwise the time the browser received the data.
 */
export const QueryFreshness = (props: { query: FreshnessQuery; source?: string; staleAfter?: Duration.Input }) => {
  const envelope = () => (isFresh(props.query.data) ? props.query.data : undefined)
  return (
    <Freshness
      at={envelope()?.asOf ?? (props.query.dataUpdatedAt > 0 ? props.query.dataUpdatedAt : undefined)}
      source={envelope()?.source ?? props.source}
      staleAfter={props.staleAfter}
      fetching={props.query.isFetching}
      onRefresh={() => void props.query.refetch()}
    />
  )
}
