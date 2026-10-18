import type { XAXisComponentOption, YAXisComponentOption } from "echarts"
import type { EChartsCoreOption } from "echarts/core"
import { type ChartOption, legendOption, tooltipValueFormatter, type ValueFormatter } from "./shared"

export interface BarChartInput {
  categories: ReadonlyArray<string>
  series: ReadonlyArray<{ name: string; data: ReadonlyArray<number> }>
  horizontal?: boolean
  valueFormatter?: ValueFormatter
}

export function barChartOption(input: BarChartInput): EChartsCoreOption {
  const format = input.valueFormatter
  const categoryAxis = {
    type: "category",
    data: [...input.categories],
    inverse: input.horizontal === true,
  } satisfies XAXisComponentOption & YAXisComponentOption
  const valueAxis = {
    type: "value",
    axisLabel: format ? { formatter: (value: number) => format(value) } : {},
  } satisfies XAXisComponentOption & YAXisComponentOption

  const option: ChartOption = {
    grid: { left: 0, right: 0, top: input.series.length > 1 ? 36 : 8, bottom: 0 },
    legend: { ...legendOption, show: input.series.length > 1 },
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "shadow" },
      valueFormatter: tooltipValueFormatter(format),
    },
    xAxis: input.horizontal ? valueAxis : categoryAxis,
    yAxis: input.horizontal ? categoryAxis : valueAxis,
    series: input.series.map((series) => ({
      type: "bar",
      name: series.name,
      data: [...series.data],
      barMaxWidth: 28,
      itemStyle: { borderRadius: input.horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    })),
  }
  return option
}
