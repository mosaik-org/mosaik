export const chartPalette = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"]

interface ThemeColors {
  text: string
  mutedText: string
  axisLine: string
  surface: string
  shadow: string
}

function createTheme(colors: ThemeColors) {
  return {
    color: chartPalette,
    backgroundColor: "transparent",
    textStyle: {
      color: colors.text,
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
    legend: {
      textStyle: { color: colors.mutedText, fontSize: 12 },
      pageTextStyle: { color: colors.mutedText },
      pageIconColor: colors.mutedText,
      inactiveColor: colors.axisLine,
    },
    tooltip: {
      backgroundColor: colors.surface,
      borderColor: colors.axisLine,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: colors.text, fontSize: 12 },
      extraCssText: `border-radius: 8px; box-shadow: ${colors.shadow};`,
      axisPointer: {
        lineStyle: { color: colors.mutedText, type: "dashed" },
        crossStyle: { color: colors.mutedText },
        shadowStyle: { color: "rgba(150, 150, 150, 0.08)" },
      },
    },
    categoryAxis: {
      axisLine: { show: true, lineStyle: { color: colors.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: colors.mutedText, fontSize: 11 },
      splitLine: { show: false, lineStyle: { color: colors.axisLine } },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.mutedText, fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: colors.axisLine } },
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
      itemStyle: { borderColor: colors.surface, borderWidth: 2 },
    },
  }
}

export const lightTheme = createTheme({
  text: "#171717",
  mutedText: "#525252",
  axisLine: "#e5e5e5",
  surface: "#ffffff",
  shadow: "0 10px 30px -10px rgba(0, 0, 0, 0.25)",
})

export const darkTheme = createTheme({
  text: "#fafafa",
  mutedText: "#a3a3a3",
  axisLine: "#262626",
  surface: "#171717",
  shadow: "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
})
