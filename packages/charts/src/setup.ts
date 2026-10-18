import { BarChart, LineChart, PieChart } from "echarts/charts"
import { DatasetComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components"
import { registerTheme, use } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"
import { darkTheme, lightTheme } from "./themes"

export const LIGHT_THEME = "mosaik-light"
export const DARK_THEME = "mosaik-dark"

use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, DatasetComponent, CanvasRenderer])

registerTheme(LIGHT_THEME, lightTheme)
registerTheme(DARK_THEME, darkTheme)
