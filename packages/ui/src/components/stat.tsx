import { css, cva } from "@mosaik/styled-system/css"
import ArrowDownRight from "lucide-solid/icons/arrow-down-right"
import ArrowUpRight from "lucide-solid/icons/arrow-up-right"
import Minus from "lucide-solid/icons/minus"
import { type JSX, Match, Show, Switch } from "solid-js"
import { Card } from "./card"
import { Skeleton } from "./skeleton"

export type TrendDirection = "up" | "down" | "flat"

const styles = {
  label: css({ fontSize: "sm", fontWeight: "medium", color: "fg.muted" }),
  body: css({ display: "flex", flexDirection: "column", gap: "1.5" }),
  valueRow: css({ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "2" }),
  value: css({
    fontSize: "2xl",
    fontWeight: "semibold",
    lineHeight: "tight",
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums",
  }),
  hint: css({ fontSize: "xs", color: "fg.subtle" }),
}

const trend = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5",
    fontSize: "xs",
    fontWeight: "medium",
    fontVariantNumeric: "tabular-nums",
    "& svg": { boxSize: "3.5" },
  },
  variants: {
    direction: {
      up: { color: "success.text" },
      down: { color: "danger.text" },
      flat: { color: "fg.muted" },
    },
  },
})

export interface StatProps {
  label: string
  value: JSX.Element
  hint?: JSX.Element
  trend?: { value: string; direction: TrendDirection }
  loading?: boolean
}

export function Stat(props: StatProps) {
  return (
    <Card>
      <div class={styles.body}>
        <span class={styles.label}>{props.label}</span>
        <Show when={!props.loading} fallback={<Skeleton height="2rem" width="60%" />}>
          <div class={styles.valueRow}>
            <span class={styles.value}>{props.value}</span>
            <Show when={props.trend}>
              {(current) => (
                <span class={trend({ direction: current().direction })}>
                  <Switch fallback={<Minus aria-hidden="true" />}>
                    <Match when={current().direction === "up"}>
                      <ArrowUpRight aria-hidden="true" />
                    </Match>
                    <Match when={current().direction === "down"}>
                      <ArrowDownRight aria-hidden="true" />
                    </Match>
                  </Switch>
                  {current().value}
                </span>
              )}
            </Show>
          </div>
        </Show>
        <Show when={props.hint}>{(hint) => <span class={styles.hint}>{hint()}</span>}</Show>
      </div>
    </Card>
  )
}
