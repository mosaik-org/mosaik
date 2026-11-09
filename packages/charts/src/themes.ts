import { token } from "@mosaik/styled-system/tokens"

/** A token of the theme, by path (`colors.fg.muted`). */
type Token = Parameters<typeof token.var>[0]

/**
 * The series' colors, in order: the theme's `chart.1`…`chart.6`. For what goes with a series outside
 * the chart (a legend of the app's own, a stat), as `token.var(CHART_COLORS[i])` or `css({ color: "chart.1" })`.
 */
export const CHART_COLORS = [
  "colors.chart.1",
  "colors.chart.2",
  "colors.chart.3",
  "colors.chart.4",
  "colors.chart.5",
  "colors.chart.6",
] as const satisfies ReadonlyArray<Token>

/** A color or the font of the theme, as the page has it where the chart is drawn. */
export type ReadToken = (path: Extract<Token, `colors.${string}` | "fonts.body">) => string

/**
 * The chart's ECharts theme, from the page's theme. Charts draw on a canvas, where CSS variables
 * mean nothing, so every color is read as a value (`resolveTokens`); the tooltip is HTML in the
 * page, so its shadow and corners are the variables themselves.
 */
export const chartTheme = (read: ReadToken) => {
  const text = read("colors.fg")
  const mutedText = read("colors.fg.muted")
  const line = read("colors.border")
  const surface = read("colors.bg.panel")
  return {
    color: CHART_COLORS.map(read),
    backgroundColor: "transparent",
    textStyle: { color: text, fontFamily: read("fonts.body") },
    legend: {
      textStyle: { color: mutedText, fontSize: 12 },
      pageTextStyle: { color: mutedText },
      pageIconColor: mutedText,
      inactiveColor: line,
    },
    tooltip: {
      backgroundColor: surface,
      borderColor: line,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: text, fontSize: 12 },
      extraCssText: `border-radius: ${token.var("radii.l2")}; box-shadow: ${token.var("shadows.lg")};`,
      axisPointer: {
        lineStyle: { color: mutedText, type: "dashed" },
        crossStyle: { color: mutedText },
        shadowStyle: { color: read("colors.gray.3") },
      },
    },
    categoryAxis: {
      axisLine: { show: true, lineStyle: { color: line } },
      axisTick: { show: false },
      axisLabel: { color: mutedText, fontSize: 11 },
      splitLine: { show: false, lineStyle: { color: line } },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: mutedText, fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: line } },
    },
    line: {
      symbol: "circle",
      symbolSize: 6,
      smooth: true,
      lineStyle: { width: 2 },
    },
    bar: {
      itemStyle: { borderRadius: 4 },
    },
    pie: {
      itemStyle: { borderColor: surface, borderWidth: 2 },
    },
  }
}

/**
 * Reads the theme's tokens as values where `element` is: its dark mode, a theme set at runtime,
 * an override on a parent. A hidden probe lets the browser resolve each variable (`var()` chains
 * included) to a color the canvas can draw with (`rgb(…)`).
 */
export const resolveTokens = <A>(element: HTMLElement, use: (read: ReadToken) => A): A => {
  const probe = document.createElement("span")
  probe.style.display = "none"
  element.append(probe)
  try {
    return use((path) => {
      const property = path.startsWith("fonts.") ? "font-family" : "color"
      probe.style.setProperty(property, token.var(path))
      return getComputedStyle(probe).getPropertyValue(property)
    })
  } finally {
    probe.remove()
  }
}
