import { type JSX, Match, Show, Switch } from "solid-js"
import { createSlotRecipeContext } from "../../styled-system/jsx"
import { stat } from "../../styled-system/recipes"
import * as Card from "../components/card"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "../components/icons"
import { Skeleton } from "../components/skeleton"

const { withProvider, withContext } = createSlotRecipeContext(stat)
const Root = withProvider("div", "root")
const Label = withContext("span", "label")
const ValueRow = withContext("div", "valueRow")
const Value = withContext("span", "value")
const Trend = withContext("span", "trend")
const Hint = withContext("span", "hint")

export type TrendDirection = "up" | "down" | "flat"

export interface StatProps {
  readonly label: string
  readonly value: JSX.Element
  /** Context under the value, such as "Last 30 days". */
  readonly hint?: JSX.Element
  /** The change against a previous period, `{ value: "+12%", direction: "up" }`. */
  readonly trend?: { readonly value: string; readonly direction: TrendDirection }
  /** Shows a placeholder for the value while it loads. */
  readonly loading?: boolean
}

/** A number in a card: revenue, open issues, uptime. */
export const Stat = (props: StatProps) => (
  <Card.Root>
    <Root direction={props.trend?.direction}>
      <Label>{props.label}</Label>
      <Show when={!props.loading} fallback={<Skeleton height="8" width="60%" />}>
        <ValueRow>
          <Value>{props.value}</Value>
          <Show when={props.trend}>
            {(trend) => (
              <Trend>
                <Switch fallback={<MinusIcon />}>
                  <Match when={trend().direction === "up"}>
                    <ArrowUpRightIcon />
                  </Match>
                  <Match when={trend().direction === "down"}>
                    <ArrowDownRightIcon />
                  </Match>
                </Switch>
                {trend().value}
              </Trend>
            )}
          </Show>
        </ValueRow>
      </Show>
      <Show when={props.hint}>
        <Hint>{props.hint}</Hint>
      </Show>
    </Root>
  </Card.Root>
)
