import type { EChartsCoreOption } from "echarts/core"
import { type ChartOption, legendOption, tooltipValueFormatter, type ValueFormatter } from "./shared"

export interface DonutChartInput {
  data: ReadonlyArray<{ name: string; value: number }>
  valueFormatter?: ValueFormatter
}

export function donutChartOption(input: DonutChartInput): EChartsCoreOption {
  const option: ChartOption = {
    legend: { ...legendOption, top: "auto", bottom: 0, left: "center" },
    tooltip: { trigger: "item", confine: true, valueFormatter: tooltipValueFormatter(input.valueFormatter) },
    series: [
      {
        type: "pie",
        radius: ["55%", "80%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        padAngle: 1,
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: input.data.map((item) => ({ name: item.name, value: item.value })),
      },
    ],
  }
  return option
}
