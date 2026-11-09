import { describe, expect, it } from "vitest"
import { CHART_COLORS, chartTheme } from "./themes"

/** Every string in the theme, wherever it is. */
const strings = (value: unknown): ReadonlyArray<string> =>
  typeof value === "string"
    ? [value]
    : typeof value === "object" && value !== null
      ? Object.values(value).flatMap(strings)
      : []

describe("chartTheme", () => {
  const theme = chartTheme((path) => `<${path}>`)

  it("draws the series in the theme's chart colors, in order", () => {
    expect(theme.color).toEqual(CHART_COLORS.map((path) => `<${path}>`))
    expect(CHART_COLORS[0]).toBe("colors.chart.1")
  })

  it("takes every color from the page's theme, none of its own", () => {
    // A literal would not follow dark mode or a theme set at runtime.
    expect(strings(theme).filter((value) => /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch)\(/i.test(value))).toEqual([])
    expect(theme.textStyle).toEqual({ color: "<colors.fg>", fontFamily: "<fonts.body>" })
    // The tooltip is HTML in the page: CSS variables work there as they are.
    expect(theme.tooltip.extraCssText).toContain("var(--mk-shadows-lg)")
  })
})
