/**
 * How many tabs, from the first, fit in `available` pixels: all of them when they do, else as many
 * as leave room for a "More" button holding the rest (`gap` between each).
 */
export const tabsThatFit = (
  widths: ReadonlyArray<number>,
  available: number,
  options: { readonly more: number; readonly gap: number },
): number => {
  const total = widths.reduce((sum, width) => sum + width, 0) + options.gap * Math.max(0, widths.length - 1)
  if (total <= available) return widths.length
  let used = options.more
  for (const [index, width] of widths.entries()) {
    used += width + options.gap
    if (used > available) return index
  }
  return widths.length
}
