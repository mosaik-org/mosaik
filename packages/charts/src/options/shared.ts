import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from "echarts/charts"
import type {
  DatasetComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from "echarts/components"
import type { ComposeOption } from "echarts/core"

export type ChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DatasetComponentOption
>

export type ValueFormatter = (value: number) => string

export function tooltipValueFormatter(format: ValueFormatter | undefined) {
  return (value: unknown) => {
    if (typeof value === "number") return format ? format(value) : value.toLocaleString()
    return value == null ? "–" : String(value)
  }
}

export const legendOption: LegendComponentOption = {
  type: "scroll",
  top: 0,
  left: 0,
  icon: "roundRect",
  itemWidth: 10,
  itemHeight: 10,
  itemGap: 16,
}
