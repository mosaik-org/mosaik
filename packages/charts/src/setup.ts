import { BarChart, LineChart, PieChart } from "echarts/charts"
import { DatasetComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components"
import { use } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"

// What the option builders use; anything else stays out of the bundle.
use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, DatasetComponent, CanvasRenderer])
