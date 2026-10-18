import type { EChartsCoreOption } from "echarts/core"
import type { ChartOption } from "./shared"

export interface SparklineInput {
  data: ReadonlyArray<number | null>
}

export function sparklineOption(input: SparklineInput): EChartsCoreOption {
  const option: ChartOption = {
    animation: false,
    grid: { left: 0, right: 0, top: 2, bottom: 2, outerBoundsMode: "none" },
    tooltip: { show: false },
    xAxis: { type: "category", show: false, boundaryGap: false, data: input.data.map((_, index) => index) },
    yAxis: { type: "value", show: false, scale: true },
    series: [
      {
        type: "line",
        data: [...input.data],
        smooth: true,
        showSymbol: false,
        connectNulls: true,
        lineStyle: { width: 1.5 },
        areaStyle: { opacity: 0.15 },
        emphasis: { disabled: true },
      },
    ],
  }
  return option
}
