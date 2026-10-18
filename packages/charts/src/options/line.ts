import type { YAXisComponentOption } from "echarts"
import type { BarSeriesOption, LineSeriesOption } from "echarts/charts"
import type { EChartsCoreOption } from "echarts/core"
import { type ChartOption, legendOption, tooltipValueFormatter, type ValueFormatter } from "./shared"

export interface LineChartSeries {
  name: string
  data: ReadonlyArray<number | null>
  type?: "line" | "bar"
  area?: boolean
  yAxisIndex?: 0 | 1
}

export interface LineChartInput {
  categories: ReadonlyArray<string>
  series: ReadonlyArray<LineChartSeries>
  valueFormatter?: ValueFormatter
  secondaryValueFormatter?: ValueFormatter
}

function valueAxis(format: ValueFormatter | undefined, showSplitLine: boolean): YAXisComponentOption {
  return {
    type: "value",
    splitLine: { show: showSplitLine },
    axisLabel: format ? { formatter: (value: number) => format(value) } : {},
  }
}

function toSeries(series: LineChartSeries, format: ValueFormatter | undefined): LineSeriesOption | BarSeriesOption {
  const common = {
    name: series.name,
    data: [...series.data],
    yAxisIndex: series.yAxisIndex ?? 0,
    tooltip: { valueFormatter: tooltipValueFormatter(format) },
  }

  if (series.type === "bar") return { ...common, type: "bar", barMaxWidth: 24 }

  return {
    ...common,
    type: "line",
    smooth: true,
    showSymbol: false,
    connectNulls: true,
    areaStyle: series.area ? { opacity: 0.12 } : undefined,
  }
}

export function lineChartOption(input: LineChartInput): EChartsCoreOption {
  const hasSecondaryAxis = input.series.some((series) => series.yAxisIndex === 1)
  const hasBars = input.series.some((series) => series.type === "bar")
  const secondaryFormatter = input.secondaryValueFormatter ?? input.valueFormatter
  const formatterFor = (series: LineChartSeries) =>
    series.yAxisIndex === 1 ? secondaryFormatter : input.valueFormatter

  const option: ChartOption = {
    grid: { left: 0, right: 0, top: 36, bottom: 0 },
    legend: { ...legendOption, show: input.series.length > 1 },
    tooltip: { trigger: "axis", confine: true },
    xAxis: { type: "category", data: [...input.categories], boundaryGap: hasBars },
    yAxis: hasSecondaryAxis
      ? [valueAxis(input.valueFormatter, true), valueAxis(secondaryFormatter, false)]
      : valueAxis(input.valueFormatter, true),
    series: input.series.map((series) => toSeries(series, formatterFor(series))),
  }
  return option
}
